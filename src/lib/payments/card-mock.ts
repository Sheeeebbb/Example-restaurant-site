/**
 * Formatting and validation for the DEMONSTRATION card form.
 *
 * This module exists so the mock checkout looks and behaves like a real one —
 * grouped digits, a Luhn check, an expiry that must be in the future. It is
 * presentation logic only.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: nothing here reaches the network, the
 * server, or any storage. The values it validates live in one component's
 * React state and are discarded when the order is submitted. There is no card
 * field in `PaymentRequest`, in `Order`, or in any persisted store — see
 * `lib/payments/types.ts`.
 *
 * With a real processor this file is DELETED, not adapted: Stripe Elements
 * renders the inputs inside its own iframe, the number goes straight from the
 * browser to Stripe, and our code never sees a digit of it. That is what keeps
 * the project out of PCI scope, and it is why the seam is drawn here.
 */

/** A widely published test number. Offered in the UI so nobody types a real card. */
export const TEST_CARD_NUMBER = "4242424242424242";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** 4242424242424242 -> "4242 4242 4242 4242" */
export function formatCardNumber(value: string): string {
  return (digitsOnly(value).match(/.{1,4}/g) ?? []).join(" ").slice(0, 19);
}

/** 1230 -> "12/30", tolerating a slash the user typed themselves. */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * The Luhn checksum every card number satisfies. Catches transposed digits,
 * which is the point of it — it says nothing about whether a card exists.
 */
export function passesLuhn(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 12) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export interface CardDraft {
  cardholder: string;
  number: string;
  expiry: string;
  cvc: string;
}

export type CardField = keyof CardDraft;
export type CardErrors = Partial<Record<CardField, string>>;

export const EMPTY_CARD: CardDraft = {
  cardholder: "",
  number: "",
  expiry: "",
  cvc: "",
};

export function validateCard(card: CardDraft, now: Date = new Date()): CardErrors {
  const errors: CardErrors = {};

  if (card.cardholder.trim().length < 2) {
    errors.cardholder = "Enter the name on the card.";
  }

  const number = digitsOnly(card.number);
  if (!number) {
    errors.number = "Enter a card number.";
  } else if (number.length < 13 || number.length > 19) {
    errors.number = "A card number is 13 to 19 digits.";
  } else if (!passesLuhn(number)) {
    errors.number = "Check the card number — a digit looks wrong.";
  }

  const expiry = digitsOnly(card.expiry);
  if (expiry.length !== 4) {
    errors.expiry = "Use MM/YY.";
  } else {
    const month = Number(expiry.slice(0, 2));
    const year = 2000 + Number(expiry.slice(2));
    if (month < 1 || month > 12) {
      errors.expiry = "That month doesn't exist.";
    } else {
      // A card is valid through the last day of its expiry month.
      const expiresAfter = new Date(year, month, 1);
      if (expiresAfter.getTime() <= now.getTime()) {
        errors.expiry = "That card has expired.";
      }
    }
  }

  const cvc = digitsOnly(card.cvc);
  if (cvc.length < 3 || cvc.length > 4) {
    errors.cvc = "The CVC is 3 or 4 digits.";
  }

  return errors;
}

export function isCardValid(card: CardDraft, now: Date = new Date()): boolean {
  return Object.keys(validateCard(card, now)).length === 0;
}

/** Last four digits, for the receipt. Never the full number. */
export function lastFour(number: string): string {
  return digitsOnly(number).slice(-4);
}
