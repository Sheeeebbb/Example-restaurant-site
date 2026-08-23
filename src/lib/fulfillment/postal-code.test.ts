import { describe, expect, it } from "vitest";
import {
  checkPostalCode,
  isDeliverablePostalCode,
  normalizePostalCode,
  postalCodeError,
} from "./postal-code";
import { DELIVERY_AREA } from "../config/restaurant";
import { findZone } from "./delivery";

/**
 * The delivery boundary is the one rule in this application that decides
 * whether a customer can order at all, so it is tested at the edges rather than
 * in the middle: the two codes that must work, and the two either side of them
 * that must not.
 */
describe("the delivery boundary", () => {
  it("delivers to the first code in the area", () => {
    expect(isDeliverablePostalCode("8930")).toBe(true);
  });

  it("delivers to the last code in the area", () => {
    expect(isDeliverablePostalCode("8940")).toBe(true);
  });

  it("does not deliver one below the area", () => {
    expect(isDeliverablePostalCode("8929")).toBe(false);
  });

  it("does not deliver one above the area", () => {
    expect(isDeliverablePostalCode("8941")).toBe(false);
  });

  it("delivers to every code between the bounds", () => {
    for (let code = DELIVERY_AREA.minPostalCode; code <= DELIVERY_AREA.maxPostalCode; code++) {
      expect(isDeliverablePostalCode(String(code)), String(code)).toBe(true);
    }
  });

  it("reads its bounds from configuration rather than repeating them", () => {
    expect(isDeliverablePostalCode(String(DELIVERY_AREA.minPostalCode - 1))).toBe(false);
    expect(isDeliverablePostalCode(String(DELIVERY_AREA.maxPostalCode + 1))).toBe(false);
  });
});

describe("normalizePostalCode", () => {
  it("strips surrounding whitespace", () => {
    expect(normalizePostalCode("  8930  ")).toBe("8930");
  });

  it("strips the spaces and hyphens people type for legibility", () => {
    expect(normalizePostalCode("89 30")).toBe("8930");
    expect(normalizePostalCode("89-30")).toBe("8930");
  });

  it("does NOT truncate a longer code into a shorter one", () => {
    // The bypass this guards: slicing "89305" to four digits made a five-digit
    // code that we do not deliver to look like 8930, which we do.
    expect(normalizePostalCode("89305")).toBe("89305");
    expect(isDeliverablePostalCode("89305")).toBe(false);
  });
});

describe("checkPostalCode", () => {
  it("says nothing at all about an empty field", () => {
    const check = checkPostalCode("");
    expect(check.status).toBe("empty");
    expect(check.message).toBeNull();
    expect(check.deliverable).toBe(false);
  });

  it("stays quiet while the code is still being typed", () => {
    for (const partial of ["8", "89", "893"]) {
      const check = checkPostalCode(partial);
      expect(check.status, partial).toBe("incomplete");
      expect(check.message, partial).toBeNull();
      expect(check.deliverable, partial).toBe(false);
    }
  });

  it("rejects non-numeric input once it is long enough to judge", () => {
    for (const bad of ["abcd", "89a0", "8 9 3 X"]) {
      const check = checkPostalCode(bad);
      expect(check.status, bad).toBe("malformed");
      expect(check.message, bad).toMatch(/4 digits/);
      expect(check.deliverable, bad).toBe(false);
    }
  });

  it("rejects a code that is too long", () => {
    expect(checkPostalCode("89305").status).toBe("malformed");
  });

  it("names the reason when a real code is outside the area", () => {
    const check = checkPostalCode("1234");
    expect(check.status).toBe("outside");
    expect(check.message).toMatch(/don't currently deliver/i);
    expect(check.value).toBe(1234);
  });

  it("confirms a code inside the area, with nothing to apologise for", () => {
    const check = checkPostalCode(" 89 35 ");
    expect(check).toMatchObject({
      status: "deliverable",
      normalized: "8935",
      value: 8935,
      deliverable: true,
      message: null,
    });
  });

  it("survives being edited from valid to invalid and back", () => {
    expect(checkPostalCode("8935").deliverable).toBe(true);
    expect(checkPostalCode("8945").deliverable).toBe(false);
    expect(checkPostalCode("8935").deliverable).toBe(true);
  });
});

describe("postalCodeError — what the form says after a failed attempt", () => {
  it("asks for a code that was never entered", () => {
    expect(postalCodeError("")).toMatch(/please enter/i);
    expect(postalCodeError("   ")).toMatch(/please enter/i);
  });

  it("asks for the rest of a half-typed code", () => {
    expect(postalCodeError("893")).toMatch(/please enter/i);
  });

  it("explains the format when the input is not a code", () => {
    expect(postalCodeError("abcd")).toMatch(/4 digits/);
  });

  it("explains the area when the code is real but out of range", () => {
    expect(postalCodeError("8941")).toMatch(/don't currently deliver/i);
  });

  it("says nothing when the code is deliverable", () => {
    expect(postalCodeError("8940")).toBeNull();
  });
});

describe("findZone", () => {
  it("returns the zone covering an in-area code", () => {
    expect(findZone("8930")?.id).toBe("zone-local");
    expect(findZone("8940")?.id).toBe("zone-local");
  });

  it("returns nothing for a code outside the area", () => {
    expect(findZone("8929")).toBeNull();
    expect(findZone("8941")).toBeNull();
  });

  it("returns nothing for input that is not a postal code", () => {
    expect(findZone("")).toBeNull();
    expect(findZone("893")).toBeNull();
    expect(findZone("89305")).toBeNull();
    expect(findZone("abcd")).toBeNull();
  });
});
