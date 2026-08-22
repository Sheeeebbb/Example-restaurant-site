import type { Address, CustomerDetails, FulfillmentType, TimingMode } from "../types";
import { findZone, normalizePostalCode } from "../fulfillment/delivery";
import { isSlotStillValid } from "../fulfillment/scheduling";
import type { DeliveryZone } from "../types";

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

export function validateOrderDraft(
  draft: OrderDraft,
  fulfillmentType: FulfillmentType,
): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = (field: DraftField) => draft[field].trim();

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

    const postalCode = normalizePostalCode(draft.postalCode);
    if (!postalCode) {
      errors.postalCode = "Please enter your postal code.";
    } else if (postalCode.length < 5) {
      errors.postalCode = "Postal codes here are five digits.";
    } else if (!findZone(postalCode)) {
      errors.postalCode = "Sorry — we don't deliver to this postal code yet.";
    }
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
 * Checks a chosen collection time is still reachable.
 *
 * A slot picked five minutes ago can fall inside the kitchen's lead time while
 * the customer is still filling in the form, so this is re-checked at the point
 * of continuing rather than only when the slot was selected.
 */
export function validateTiming(
  timing: TimingMode,
  scheduledFor: string | undefined,
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  now: Date = new Date(),
): string | null {
  if (timing === "asap") return null;
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
    deliveryInstructions: draft.deliveryInstructions.trim() || undefined,
  };
}
