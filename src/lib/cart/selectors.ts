"use client";

import { useMemo } from "react";
import { useCartStore } from "./store";
import {
  baseDeliveryFee,
  calculateTotals,
  countItems,
  deliveryFeeWaiver,
  deliveryShortfall,
} from "./totals";
import { findZone } from "../fulfillment/delivery";
import { checkPostalCode } from "../fulfillment/postal-code";
import { validatePromotion } from "../data/promotions";
import type { OrderTotals, Promotion } from "../types";

/**
 * Derived cart values.
 *
 * Everything here is computed rather than stored, so there is no way for a
 * cached total to drift out of step with the lines it came from. The promo code
 * is re-validated on every read for the same reason.
 */

/** Item count for the header badge. Returns 0 until hydrated, matching the server render. */
export function useCartCount(): number {
  const lines = useCartStore((state) => state.lines);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  return hasHydrated ? countItems(lines) : 0;
}

export interface CartSummary {
  totals: OrderTotals;
  promotion: Promotion | null;
  /** Set when a stored code no longer qualifies — e.g. the basket shrank. */
  promotionError: string | null;
  /** How far below the zone's minimum order the basket is; 0 when it qualifies. */
  shortfall: number;
  /**
   * False ONLY when a complete postal code has been entered and no zone covers
   * it. Before an address exists we do not yet know, and claiming "we don't
   * deliver here" on an empty field would be wrong.
   */
  deliverable: boolean;
  /** The fee before any waiver, so the summary can show "4,49 € waived". */
  deliveryFeeBeforeWaiver: number;
  /** Why delivery is free, if it is — for an explanatory line in the summary. */
  waiver: "threshold" | "promotion" | null;
  itemCount: number;
}

export function useCartSummary(): CartSummary {
  const lines = useCartStore((state) => state.lines);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const postalCode = useCartStore((state) => state.postalCode);
  const promotionCode = useCartStore((state) => state.promotionCode);

  return useMemo(() => {
    const zone = fulfillmentType === "delivery" ? findZone(postalCode) : null;

    let promotion: Promotion | null = null;
    let promotionError: string | null = null;

    if (promotionCode) {
      const subtotal = lines.reduce(
        (total, line) => total + line.unitPrice * line.quantity,
        0,
      );
      const result = validatePromotion(promotionCode, subtotal, fulfillmentType);
      if (result.ok) {
        promotion = result.promotion;
      } else {
        promotionError = result.message;
      }
    }

    const input = { lines, fulfillmentType, zone, promotion };
    // "Complete" means a well-formed code, not merely a long one: half-typed
    // input must not be answered with "we don't deliver there".
    const postal = checkPostalCode(postalCode);
    const postalCodeSettled = postal.status === "deliverable" || postal.status === "outside";

    return {
      totals: calculateTotals(input),
      promotion,
      promotionError,
      shortfall: deliveryShortfall(lines, fulfillmentType, zone),
      deliverable:
        fulfillmentType === "pickup" || !postalCodeSettled || zone !== null,
      deliveryFeeBeforeWaiver: baseDeliveryFee(fulfillmentType, zone),
      waiver: deliveryFeeWaiver(input),
      itemCount: countItems(lines),
    };
  }, [lines, fulfillmentType, postalCode, promotionCode]);
}
