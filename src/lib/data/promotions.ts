import type {
  Cents,
  FulfillmentType,
  Promotion,
  PromotionResult,
} from "../types";
import { englishMessages, type Messages } from "../../i18n/messages";

/**
 * Seed promotional codes.
 *
 * SECURITY NOTE: validating a code in the browser is a convenience, not a
 * control. Anyone can edit client state and claim any discount. The same
 * `validatePromotion` runs server-side at checkout against the authoritative
 * subtotal, and that result is the one that decides what gets charged. Keeping
 * both callers on this one function is what stops the two from drifting apart.
 */

export const PROMOTIONS: Promotion[] = [
  {
    /** The code advertised on the homepage. Keep the two in step via `FIRST_ORDER_PROMO`. */
    code: "WELCOME20",
    kind: "percentage",
    value: 20,
    description: "20% off your first order",
    minimumSubtotal: 1500,
    appliesTo: "all",
    active: true,
  },
  {
    code: "PICKUP5",
    kind: "fixed",
    value: 500,
    description: "5 € off when you collect",
    minimumSubtotal: 2000,
    appliesTo: ["pickup"],
    active: true,
  },
  {
    code: "FREERIDE",
    kind: "free-delivery",
    value: 0,
    description: "Free delivery, no minimum",
    minimumSubtotal: 0,
    appliesTo: ["delivery"],
    active: true,
  },
  {
    code: "SUMMER24",
    kind: "percentage",
    value: 15,
    description: "Expired summer promotion",
    minimumSubtotal: 3000,
    appliesTo: "all",
    active: true,
    expiresAt: "2024-09-01T00:00:00.000Z",
  },
];

/**
 * The promotion the homepage advertises.
 *
 * The banner reads its code, headline, and minimum from this one record, so the
 * marketing copy cannot drift away from what the cart will actually accept.
 * Changing the offer here changes both.
 */
export const FIRST_ORDER_PROMO = PROMOTIONS[0];

export function findPromotion(code: string): Promotion | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return PROMOTIONS.find((promotion) => promotion.code === normalized) ?? null;
}

/**
 * Validates a code against the current basket.
 *
 * Returns a reason on failure rather than a bare boolean, so the UI can say
 * "spend $6 more to use this code" instead of "invalid code" — a rejection a
 * customer can act on recovers the sale.
 */
export function validatePromotion(
  code: string,
  subtotal: Cents,
  fulfillmentType: FulfillmentType,
  now: Date = new Date(),
  /*
   * The customer's language, defaulting to English — the arrangement used by
   * `validateOrderDraft` and `customerRefundNotice`. `reason` stays a
   * language-neutral code, so server callers can branch on it without ever
   * reading the sentence.
   */
  t: Messages = englishMessages,
): PromotionResult {
  const promotion = findPromotion(code);

  if (!promotion) {
    return {
      ok: false,
      reason: "not-found",
      message: t("cart.promoNotFound"),
    };
  }

  if (!promotion.active) {
    return {
      ok: false,
      reason: "inactive",
      message: t("cart.promoInactive"),
    };
  }

  if (promotion.expiresAt && new Date(promotion.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired", message: t("cart.promoExpired") };
  }

  if (
    promotion.appliesTo !== "all" &&
    !promotion.appliesTo.includes(fulfillmentType)
  ) {
    // Two whole sentences rather than one with the mode dropped in: Dutch
    // inflects "bezorg-"/"afhaal-" into the noun, not as a separate word.
    const pickupOnly = promotion.appliesTo[0] === "pickup";
    return {
      ok: false,
      reason: "wrong-fulfillment",
      message: t(pickupOnly ? "cart.promoPickupOnly" : "cart.promoDeliveryOnly"),
    };
  }

  if (subtotal < promotion.minimumSubtotal) {
    return {
      ok: false,
      reason: "below-minimum",
      message: t("cart.promoBelowMinimum"),
    };
  }

  return { ok: true, promotion };
}
