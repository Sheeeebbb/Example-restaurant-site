import { describe, expect, it } from "vitest";
import { validatePromotion } from "./promotions";

const NOW = new Date("2026-08-22T18:00:00.000Z");

describe("validatePromotion", () => {
  it("accepts a valid code that clears its minimum", () => {
    const result = validatePromotion("WELCOME10", 3000, "delivery", NOW);
    expect(result.ok).toBe(true);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    const result = validatePromotion("  welcome10 ", 3000, "delivery", NOW);
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown code", () => {
    const result = validatePromotion("NOPE", 3000, "delivery", NOW);
    expect(result).toMatchObject({ ok: false, reason: "not-found" });
  });

  it("rejects a basket below the code's minimum", () => {
    const result = validatePromotion("WELCOME10", 500, "delivery", NOW);
    expect(result).toMatchObject({ ok: false, reason: "below-minimum" });
  });

  it("rejects a pickup-only code on a delivery order", () => {
    const result = validatePromotion("PICKUP5", 5000, "delivery", NOW);
    expect(result).toMatchObject({ ok: false, reason: "wrong-fulfillment" });
  });

  it("accepts that same code on a pickup order", () => {
    const result = validatePromotion("PICKUP5", 5000, "pickup", NOW);
    expect(result.ok).toBe(true);
  });

  it("rejects an expired code", () => {
    const result = validatePromotion("SUMMER24", 5000, "pickup", NOW);
    expect(result).toMatchObject({ ok: false, reason: "expired" });
  });

  it("gives every rejection a message worth showing a customer", () => {
    const result = validatePromotion("NOPE", 100, "delivery", NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});
