import type { Address, CustomerDetails, FulfillmentType, TimingMode } from "../types";
import { normalizePostalCode, postalCodeError } from "../fulfillment/postal-code";
import { isAcceptingOrdersAt, isSlotStillValid } from "../fulfillment/scheduling";
import type { DeliveryZone } from "../types";
import { RESTAURANT } from "../config/restaurant";

/**
 * Validation for the order configuration step.
 *
 * Pure and UI-free, so the same rules can run in the browser for instant
 * feedback and again on the server before an order is accepted. Client-side
 * validation is a courtesy; it is not a control, and anything enforced here
 * must be re-checked when the order is actually placed.
 *
 * Errors are keyed by field so each input can show its own message inline
 * rather than dumping a list at the top of the form.
 */

/** Everything the customer fills in. Flat, because that is how a form is shaped. */
export interface OrderDraft {
  name: string;
  phone: string;
  email: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  deliveryInstructions: string;
}

export type DraftField = keyof OrderDraft;
export type FieldErrors = Partial<Record<DraftField, string>>;

export const EMPTY_DRAFT: OrderDraft = {
  name: "",
  phone: "",
  email: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  deliveryInstructions: "",
};

/** Which fields the customer must fill in, given how they want their order. */
export function requiredFields(fulfillmentType: FulfillmentType): DraftField[] {
  const always: DraftField[] = ["name", "phone", "email"];
  if (fulfillmentType === "pickup") return always;
  return [...always, "street", "houseNumber", "postalCode", "city"];
}

/**
 * Deliberately permissive: one @, something either side, a dot in the domain.
 * Stricter patterns reject valid addresses, and the only real test of an email
 * is sending to it.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Counts digits rather than matching a format. Phone numbers here may be
 * written +49 30 5550 1420, 030 5550 1420 or 03055501420, and all three are
 * the same number.
 */
function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * Upper bounds on free-text fields.
 *
 * These are not cosmetic. Without them the API accepted a 5,000-character name
 * and stored it on the order — which breaks kitchen tickets, bloats storage,
 * and is exactly the sort of unbounded input that should never reach a
 * database. `maxLength` on an input is a courtesy to the customer; this is the
 * actual limit, and it runs on the server too.
 */
export const FIELD_LIMITS = {
  name: 80,
  phone: 30,
  email: 254, // RFC 5321 maximum
  street: 120,
  houseNumber: 20,
  postalCode: 12,
  city: 80,
  deliveryInstructions: 300,
} as const satisfies Record<DraftField, number>;

export function validateOrderDraft(
  draft: OrderDraft,
  fulfillmentType: FulfillmentType,
): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = (field: DraftField) => draft[field].trim();

  // Length first: an over-long value is rejected whatever else it contains.
  for (const [field, limit] of Object.entries(FIELD_LIMITS) as [DraftField, number][]) {
    if ((draft[field] ?? "").length > limit) {
      errors[field] = `Please keep this under ${limit} characters.`;
    }
  }

  if (trimmed("name").length < 2) {
    errors.name = "Please enter your full name.";
  }

  if (!trimmed("phone")) {
    errors.phone = "We need a phone number in case the driver can't find you.";
  } else if (digitCount(draft.phone) < 6) {
    errors.phone = "That doesn't look like a complete phone number.";
  }

  if (!trimmed("email")) {
    errors.email = "We'll send your receipt here.";
  } else if (!looksLikeEmail(draft.email)) {
    errors.email = "Please check this email address.";
  }

  if (fulfillmentType === "delivery") {
    if (!trimmed("street")) errors.street = "Please enter your street.";
    if (!trimmed("houseNumber")) {
      errors.houseNumber = "Please add the house or apartment number.";
    }
    if (!trimmed("city")) errors.city = "Please enter your city.";

    /*
     * Empty, half-typed, malformed and out-of-area all resolve here, in the
     * module that owns the delivery boundary — so this runs the same rule the
     * address form shows live and the server re-runs before accepting the
     * order. A delivery order cannot be placed while this returns a message.
     */
    const postalProblem = postalCodeError(draft.postalCode);
    if (postalProblem) errors.postalCode = postalProblem;
  }

  return errors;
}

export function isDraftValid(
  draft: OrderDraft,
  fulfillmentType: FulfillmentType,
): boolean {
  return Object.keys(validateOrderDraft(draft, fulfillmentType)).length === 0;
}

/**
 * Checks the requested time is one the kitchen can actually meet.
 *
 * Two distinct cases:
 *
 *   • ASAP means "start cooking now", so the kitchen has to be open now. Without
 *     this check an order placed at 4am, or on a Monday when the restaurant is
 *     shut all day, was accepted and paid for with nobody there to cook it.
 *
 *   • A scheduled slot may legitimately be booked while closed — ordering
 *     tomorrow's lunch at midnight is normal — so it is checked against the
 *     slot's own opening hours instead, and re-checked here because a slot
 *     picked five minutes ago can fall inside the lead time while the customer
 *     is still filling in the form.
 */
export function validateTiming(
  timing: TimingMode,
  scheduledFor: string | undefined,
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  now: Date = new Date(),
): string | null {
  if (timing === "asap") {
    return isAcceptingOrdersAt(now)
      ? null
      : `${RESTAURANT.name} isn't taking orders right now. Schedule one for later instead.`;
  }
  if (!scheduledFor) return "Please choose a time.";
  if (!isSlotStillValid(scheduledFor, now, fulfillmentType, zone)) {
    return "That time has passed. Please pick another.";
  }
  return null;
}

/** Splits a validated draft into the shapes the order model stores. */
export function toCustomerDetails(draft: OrderDraft): CustomerDetails {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
  };
}

export function toAddress(draft: OrderDraft): Address {
  return {
    street: draft.street.trim(),
    houseNumber: draft.houseNumber.trim(),
    postalCode: normalizePostalCode(draft.postalCode),
    city: draft.city.trim(),
    // Optional, and the only field here that can legitimately be absent: a
    // request that omits it is well formed, so it must not crash the endpoint.
    deliveryInstructions: draft.deliveryInstructions?.trim() || undefined,
  };
}
