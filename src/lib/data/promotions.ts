import type {
  Cents,
  FulfillmentType,
  Promotion,
  PromotionResult,
} from "../types";

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
    code: "WELCOME10",
    kind: "percentage",
    value: 10,
    description: "10% off your first order",
    minimumSubtotal: 2000,
    appliesTo: "all",
    active: true,
  },
  {
    code: "PICKUP5",
    kind: "fixed",
    value: 500,
    description: "$5 off when you collect",
    minimumSubtotal: 2500,
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
): PromotionResult {
  const promotion = findPromotion(code);

  if (!promotion) {
    return {
      ok: false,
      reason: "not-found",
      message: "We don't recognise that code.",
    };
  }

  if (!promotion.active) {
    return {
      ok: false,
      reason: "inactive",
      message: "That code is no longer available.",
    };
  }

  if (promotion.expiresAt && new Date(promotion.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired", message: "That code has expired." };
  }

  if (
    promotion.appliesTo !== "all" &&
    !promotion.appliesTo.includes(fulfillmentType)
  ) {
    const allowed = promotion.appliesTo[0] === "pickup" ? "pickup" : "delivery";
    return {
      ok: false,
      reason: "wrong-fulfillment",
      message: `That code only applies to ${allowed} orders.`,
    };
  }

  if (subtotal < promotion.minimumSubtotal) {
    return {
      ok: false,
      reason: "below-minimum",
      message: `Spend a little more to use this code.`,
    };
  }

  return { ok: true, promotion };
}
