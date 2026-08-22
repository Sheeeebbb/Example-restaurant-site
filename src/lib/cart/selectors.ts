"use client";

import { useMemo } from "react";
import { useCartStore } from "./store";
import { calculateTotals, countItems, deliveryShortfall } from "./totals";
import { findZone } from "../fulfillment/delivery";
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
  deliverable: boolean;
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

    return {
      totals: calculateTotals({ lines, fulfillmentType, zone, promotion }),
      promotion,
      promotionError,
      shortfall: deliveryShortfall(lines, fulfillmentType, zone),
      deliverable: fulfillmentType === "pickup" || zone !== null,
      itemCount: countItems(lines),
    };
  }, [lines, fulfillmentType, postalCode, promotionCode]);
}
