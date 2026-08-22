import { describe, expect, it } from "vitest";
import {
  EMPTY_CARD,
  TEST_CARD_NUMBER,
  formatCardNumber,
  formatExpiry,
  isCardValid,
  passesLuhn,
  validateCard,
  type CardDraft,
} from "./card-mock";

const NOW = new Date(2026, 7, 22);

const valid: CardDraft = {
  cardholder: "Marta Kowalski",
  number: TEST_CARD_NUMBER,
  expiry: "12/30",
  cvc: "123",
};

describe("formatting", () => {
  it("groups a card number in fours", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
  });

  it("ignores anything that isn't a digit", () => {
    expect(formatCardNumber("4242-4242 abc 4242")).toBe("4242 4242 4242");
  });

  it("never exceeds a card's width", () => {
    expect(formatCardNumber("4".repeat(40)).length).toBeLessThanOrEqual(19);
  });

  it("inserts the expiry slash once the month is complete", () => {
    expect(formatExpiry("1")).toBe("1");
    expect(formatExpiry("12")).toBe("12");
    expect(formatExpiry("123")).toBe("12/3");
    expect(formatExpiry("1230")).toBe("12/30");
  });

  it("tolerates a slash the customer typed", () => {
    expect(formatExpiry("12/30")).toBe("12/30");
  });
});

describe("Luhn", () => {
  it("accepts published test numbers", () => {
    for (const n of ["4242424242424242", "5555555555554444", "378282246310005"]) {
      expect(passesLuhn(n), n).toBe(true);
    }
  });

  it("rejects a transposed digit", () => {
    expect(passesLuhn("4242424242424252")).toBe(false);
  });

  it("rejects something far too short", () => {
    expect(passesLuhn("4242")).toBe(false);
  });
});

describe("validateCard", () => {
  it("accepts a complete card", () => {
    expect(validateCard(valid, NOW)).toEqual({});
    expect(isCardValid(valid, NOW)).toBe(true);
  });

  it("flags every field when empty", () => {
    const errors = validateCard(EMPTY_CARD, NOW);
    expect(Object.keys(errors).sort()).toEqual(["cardholder", "cvc", "expiry", "number"]);
  });

  it("rejects a number that fails the checksum", () => {
    expect(validateCard({ ...valid, number: "4242424242424243" }, NOW).number)
      .toMatch(/digit looks wrong/i);
  });

  it("rejects an expired card", () => {
    expect(validateCard({ ...valid, expiry: "07/26" }, NOW).expiry).toMatch(/expired/i);
  });

  it("accepts a card expiring in the current month", () => {
    // Valid through the last day of August 2026.
    expect(validateCard({ ...valid, expiry: "08/26" }, NOW).expiry).toBeUndefined();
  });

  it("rejects an impossible month", () => {
    expect(validateCard({ ...valid, expiry: "13/30" }, NOW).expiry).toMatch(/month/i);
  });

  it("accepts a 4-digit CVC, rejects 2", () => {
    expect(validateCard({ ...valid, cvc: "1234" }, NOW).cvc).toBeUndefined();
    expect(validateCard({ ...valid, cvc: "12" }, NOW).cvc).toBeTruthy();
  });
});

