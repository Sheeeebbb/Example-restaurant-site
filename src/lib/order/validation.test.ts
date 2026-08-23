import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  isDraftValid,
  requiredFields,
  toAddress,
  toCustomerDetails,
  validateOrderDraft,
  validateTiming,
  type OrderDraft,
} from "./validation";
import { findZone } from "../fulfillment/delivery";

const valid: OrderDraft = {
  name: "Marta Kowalski",
  phone: "+49 30 5550 1420",
  email: "marta@example.com",
  street: "Oranienstraße",
  houseNumber: "148",
  postalCode: "8930",
  city: "Berlin",
  deliveryInstructions: "Buzzer 3B",
};

describe("requiredFields", () => {
  it("asks pickup customers only for contact details", () => {
    expect(requiredFields("pickup")).toEqual(["name", "phone", "email"]);
  });

  it("adds the address for delivery", () => {
    expect(requiredFields("delivery")).toContain("street");
    expect(requiredFields("delivery")).toContain("houseNumber");
    expect(requiredFields("delivery")).toContain("postalCode");
    expect(requiredFields("delivery")).toContain("city");
  });
});

describe("validateOrderDraft", () => {
  it("accepts a complete delivery draft", () => {
    expect(validateOrderDraft(valid, "delivery")).toEqual({});
    expect(isDraftValid(valid, "delivery")).toBe(true);
  });

  it("accepts a pickup draft with no address at all", () => {
    const pickup: OrderDraft = {
      ...EMPTY_DRAFT,
      name: valid.name,
      phone: valid.phone,
      email: valid.email,
    };
    expect(isDraftValid(pickup, "pickup")).toBe(true);
  });

  it("rejects that same pickup draft for delivery", () => {
    const pickup: OrderDraft = {
      ...EMPTY_DRAFT,
      name: valid.name,
      phone: valid.phone,
      email: valid.email,
    };
    const errors = validateOrderDraft(pickup, "delivery");
    expect(Object.keys(errors).sort()).toEqual([
      "city",
      "houseNumber",
      "postalCode",
      "street",
    ]);
  });

  it("flags an empty draft on every required field", () => {
    const errors = validateOrderDraft(EMPTY_DRAFT, "delivery");
    for (const field of requiredFields("delivery")) {
      expect(errors[field], field).toBeTruthy();
    }
  });

  it("treats whitespace as empty", () => {
    const errors = validateOrderDraft({ ...valid, name: "   " }, "delivery");
    expect(errors.name).toBeTruthy();
  });

  it("rejects a one-character name", () => {
    expect(validateOrderDraft({ ...valid, name: "M" }, "delivery").name).toBeTruthy();
  });

  it("accepts phone numbers in any common format", () => {
    for (const phone of ["+49 30 5550 1420", "030 5550 1420", "03055501420"]) {
      expect(validateOrderDraft({ ...valid, phone }, "delivery").phone, phone).toBeUndefined();
    }
  });

  it("rejects a phone number with too few digits", () => {
    expect(validateOrderDraft({ ...valid, phone: "123" }, "delivery").phone).toBeTruthy();
  });

  it("rejects malformed emails", () => {
    for (const email of ["marta", "marta@", "@example.com", "marta@example", "a b@c.com"]) {
      expect(validateOrderDraft({ ...valid, email }, "delivery").email, email).toBeTruthy();
    }
  });

  it("accepts a plus-addressed email", () => {
    const errors = validateOrderDraft({ ...valid, email: "marta+food@example.co.uk" }, "delivery");
    expect(errors.email).toBeUndefined();
  });

  it("rejects a postal code outside the delivery area, with a reason", () => {
    const errors = validateOrderDraft({ ...valid, postalCode: "9999" }, "delivery");
    expect(errors.postalCode).toMatch(/don't currently deliver/i);
  });

  it("rejects a short postal code differently from an uncovered one", () => {
    expect(validateOrderDraft({ ...valid, postalCode: "893" }, "delivery").postalCode)
      .toMatch(/please enter/i);
  });

  it("accepts a postal code written with a space", () => {
    expect(validateOrderDraft({ ...valid, postalCode: "89 30" }, "delivery").postalCode)
      .toBeUndefined();
  });

  it("never lets a delivery order through on a postal code outside the area", () => {
    for (const code of ["8929", "8941", "10969", "", "abcd", "89305"]) {
      const errors = validateOrderDraft({ ...valid, postalCode: code }, "delivery");
      expect(errors.postalCode, code || "(empty)").toBeTruthy();
      expect(isDraftValid({ ...valid, postalCode: code }, "delivery")).toBe(false);
    }
  });

  it("asks pickup customers nothing about postal codes", () => {
    for (const code of ["", "8929", "not a code"]) {
      expect(validateOrderDraft({ ...valid, postalCode: code }, "pickup").postalCode)
        .toBeUndefined();
    }
  });

  it("never requires delivery instructions", () => {
    const errors = validateOrderDraft({ ...valid, deliveryInstructions: "" }, "delivery");
    expect(errors.deliveryInstructions).toBeUndefined();
  });
});

describe("validateTiming", () => {
  const zone = findZone("8930");
  // A Wednesday lunchtime, when the kitchen is open.
  const now = new Date(2026, 7, 19, 12, 0, 0);

  it("always accepts ASAP", () => {
    expect(validateTiming("asap", undefined, "delivery", zone, now)).toBeNull();
  });

  it("requires a slot when scheduling", () => {
    expect(validateTiming("scheduled", undefined, "delivery", zone, now)).toBeTruthy();
  });

  it("accepts a slot comfortably ahead", () => {
    const slot = new Date(2026, 7, 19, 19, 0, 0).toISOString();
    expect(validateTiming("scheduled", slot, "delivery", zone, now)).toBeNull();
  });

  it("rejects a slot that has since fallen inside the lead time", () => {
    const slot = new Date(2026, 7, 19, 12, 5, 0).toISOString();
    expect(validateTiming("scheduled", slot, "delivery", zone, now)).toMatch(/passed/i);
  });

  it("rejects a slot on a day the restaurant is closed", () => {
    const monday = new Date(2026, 7, 24, 19, 0, 0).toISOString();
    expect(validateTiming("scheduled", monday, "delivery", zone, now)).toBeTruthy();
  });
});

describe("converting a draft for the order", () => {
  it("trims contact details", () => {
    const messy = { ...valid, name: "  Marta  ", email: " marta@example.com " };
    expect(toCustomerDetails(messy)).toEqual({
      name: "Marta",
      email: "marta@example.com",
      phone: "+49 30 5550 1420",
    });
  });

  it("normalises the postal code and keeps instructions optional", () => {
    expect(toAddress({ ...valid, postalCode: " 89 30 " })).toEqual({
      street: "Oranienstraße",
      houseNumber: "148",
      postalCode: "8930",
      city: "Berlin",
      deliveryInstructions: "Buzzer 3B",
    });
    expect(toAddress({ ...valid, deliveryInstructions: "   " }).deliveryInstructions)
      .toBeUndefined();
  });
});
