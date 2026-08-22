import type {
  CartLine,
  Cents,
  DeliveryZone,
  FulfillmentType,
  OrderTotals,
  Promotion,
} from "../types";
import { RESTAURANT } from "../config/restaurant";
import { clampToZero, percentOf, vatWithin } from "../money";

/**
 * The single pricing engine.
 *
 * This module is deliberately pure and free of browser and React imports so the
 * exact same function can run in the cart UI (for display) and later inside a
 * route handler (for authority). Two implementations of pricing is how a
 * checkout ends up charging a different number from the one on screen.
 *
 * The client's computed total is never trusted at checkout: the server recomputes
 * from live menu data and charges its own figure. What the client calculates is
 * a preview.
 */

export interface TotalsInput {
  lines: CartLine[];
  fulfillmentType: FulfillmentType;
  /**
   * The matched zone for a delivery order, or null when no postal code has been
   * entered yet — in which case the flat configured fee applies.
   */
  zone: DeliveryZone | null;
  promotion: Promotion | null;
}

export function calculateSubtotal(lines: CartLine[]): Cents {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((count, line) => count + line.quantity, 0);
}

/**
 * The base delivery fee before any promotion, so the UI can show
 * "$4.99 waived" rather than silently dropping the row.
 */
export function baseDeliveryFee(
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
): Cents {
  if (fulfillmentType === "pickup") return 0;
  // The configured flat fee is the default; a matched zone may override it.
  // Falling back to 0 here would show "free delivery" in the cart before an
  // address is known, then quietly add a charge at checkout.
  return zone?.deliveryFee ?? RESTAURANT.fees.deliveryFee;
}

export function calculateTotals({
  lines,
  fulfillmentType,
  zone,
  promotion,
}: TotalsInput): OrderTotals {
  const subtotal = calculateSubtotal(lines);

  // Discounts apply to the food only. Discounting the delivery fee or the tax
  // would mean giving away a third party's money.
  let discount: Cents = 0;
  if (promotion) {
    if (promotion.kind === "percentage") {
      discount = percentOf(subtotal, promotion.value);
    } else if (promotion.kind === "fixed") {
      discount = Math.min(promotion.value, subtotal);
    }
  }
  discount = clampToZero(Math.min(discount, subtotal));

  const fee = baseDeliveryFee(fulfillmentType, zone);
  const waivedByThreshold =
    fee > 0 && subtotal >= RESTAURANT.fees.freeDeliveryThreshold;
  const waivedByPromotion = fee > 0 && promotion?.kind === "free-delivery";
  const deliveryFee = waivedByThreshold || waivedByPromotion ? 0 : fee;

  const total = clampToZero(subtotal - discount + deliveryFee);

  // VAT is INCLUDED in menu prices in this market, so it is extracted from the
  // total rather than added to it. `tax` is a receipt line telling the customer
  // how much of what they already paid was VAT — adding it on top would
  // overcharge every order by the VAT rate.
  const tax = vatWithin(total, RESTAURANT.fees.taxRatePercent);

  return { subtotal, discount, deliveryFee, tax, total };
}

/** Whether the delivery fee was dropped, and why — for an explanatory line in the summary. */
export function deliveryFeeWaiver(
  input: TotalsInput,
): "threshold" | "promotion" | null {
  const fee = baseDeliveryFee(input.fulfillmentType, input.zone);
  if (fee === 0) return null;
  if (input.promotion?.kind === "free-delivery") return "promotion";
  if (calculateSubtotal(input.lines) >= RESTAURANT.fees.freeDeliveryThreshold) {
    return "threshold";
  }
  return null;
}

/**
 * Delivery zones carry a minimum order value. Returns the shortfall in cents,
 * or 0 when the basket qualifies, so the cart can say how much more is needed.
 */
export function deliveryShortfall(
  lines: CartLine[],
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
): Cents {
  if (fulfillmentType === "pickup" || !zone) return 0;
  return clampToZero(zone.minimumOrder - calculateSubtotal(lines));
}
