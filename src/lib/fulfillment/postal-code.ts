import { DELIVERY_AREA } from "../config/restaurant";
import { englishMessages, type Messages } from "../../i18n/messages";

/**
 * The one place that decides whether a postal code can be delivered to.
 *
 * Pure and UI-free, so the address form can use it for live feedback while the
 * customer types, `validateOrderDraft` can use it to block the continue button,
 * and the server can use it again before accepting the order — all reaching the
 * same verdict, because there is only one implementation of the rule. Client
 * checks are a courtesy; the server check is the control.
 *
 * The boundaries themselves live in `DELIVERY_AREA`, not here.
 */

export type PostalCodeStatus =
  /** Nothing typed yet. */
  | "empty"
  /** Fewer digits than a postal code has — probably still typing. */
  | "incomplete"
  /** Right length or longer, but not a postal code: letters, punctuation, too many digits. */
  | "malformed"
  /** A real postal code, outside the area we drive to. */
  | "outside"
  /** A real postal code, inside the area. */
  | "deliverable";

export interface PostalCodeCheck {
  status: PostalCodeStatus;
  /** What to store and compare: the input minus the characters people type for legibility. */
  normalized: string;
  /**
   * Just the digits, once there are enough of them to have a complete area.
   * Null otherwise.
   *
   * This — not `normalized` — is what the delivery rule reads, so adding or
   * removing the letter suffix can never change whether we deliver somewhere.
   */
  area: string | null;
  /**
   * The letter suffix, when the customer has typed all of it. Null otherwise.
   *
   * Its only consumer is address lookup: the digits identify a town, and the
   * letters are what narrow that to a street.
   */
  letters: string | null;
  /** The numeric value, once it is a well-formed code. Null otherwise. */
  value: number | null;
  /** True only for a complete, in-range code. Never true while anything is uncertain. */
  deliverable: boolean;
  /**
   * Why not, in the customer's words. Null when there is nothing to say —
   * including while the code is merely unfinished, because telling someone
   * their postal code is wrong after two digits is just impatience.
   */
  message: string | null;
}

/**
 * Strips the characters people put in postal codes for legibility — spaces and
 * hyphens — and upper-cases what is left.
 *
 * Deliberately does NOT strip letters or truncate to length. "89 30" and "8930"
 * are the same code and both normalise to "8930", but "8930x" and "89305" stay
 * as typed so the check below can reject them. An earlier version capped the
 * result at the postal-code length, which turned the five-digit "89305" into a
 * deliverable "8930" — a wrong address that passed every check on the way to
 * the kitchen.
 *
 * Upper-casing is what makes "8934 ab", "8934ab" and "8934 AB" one code. Only
 * the letter suffix is affected; digits are unchanged by it.
 */
export function normalizePostalCode(input: string): string {
  return input.trim().replace(/[\s-]/g, "").toUpperCase();
}



/**
 * The shape of a well-formed code: the area digits, then up to the configured
 * number of letters.
 *
 * The letters are optional on purpose. Delivery is decided by the digits, so a
 * half-typed suffix must not turn a code the customer already completed back
 * into an error — they would watch "we deliver here" disappear as they carried
 * on typing their own postal code.
 */
const WELL_FORMED = new RegExp(
  DELIVERY_AREA.letters > 0
    ? `^(\\d{${DELIVERY_AREA.digits}})([A-Z]{0,${DELIVERY_AREA.letters}})$`
    : `^(\\d{${DELIVERY_AREA.digits}})()$`,
);

export function checkPostalCode(
  input: string,
  /** Defaults to English; the address form passes the customer's language. */
  t: Messages = englishMessages,
): PostalCodeCheck {
  const normalized = normalizePostalCode(input);
  const nothing = { normalized, area: null, letters: null, value: null, deliverable: false };

  if (!normalized) {
    return { ...nothing, status: "empty", message: null };
  }

  // Still shorter than the area, and made only of digits: they are typing.
  if (/^\d+$/.test(normalized) && normalized.length < DELIVERY_AREA.digits) {
    return { ...nothing, status: "incomplete", message: null };
  }

  const match = WELL_FORMED.exec(normalized);

  if (!match) {
    return {
      ...nothing,
      status: "malformed",
      message: t("delivery.postalCodeLength", { digits: DELIVERY_AREA.digits }),
    };
  }

  const [, area, suffix] = match;
  const value = Number(area);
  const inside =
    value >= DELIVERY_AREA.minPostalCode && value <= DELIVERY_AREA.maxPostalCode;

  return {
    status: inside ? "deliverable" : "outside",
    normalized,
    area,
    // Only a complete suffix is worth handing to a lookup; half of one narrows
    // nothing and would just be a wasted request.
    letters: suffix.length === DELIVERY_AREA.letters ? suffix : null,
    value,
    deliverable: inside,
    message: inside ? null : t("delivery.outsideArea"),
  };
}

/** True only for a complete, in-range code. */
export function isDeliverablePostalCode(input: string): boolean {
  return checkPostalCode(input).deliverable;
}

/**
 * The error to show once the customer has tried to continue.
 *
 * Differs from `check.message` in one place only: an empty or half-typed code
 * says nothing while they are still filling the form, but has to say something
 * once they have asked to move on.
 */
export function postalCodeError(
  input: string,
  t: Messages = englishMessages,
): string | null {
  const check = checkPostalCode(input, t);
  if (check.status === "empty" || check.status === "incomplete") {
    return t("delivery.postalCodeRequired");
  }
  return check.message;
}
