import { describe, expect, it } from "vitest";
import { calculateTotals, deliveryShortfall } from "./totals";
import type { CartLine, DeliveryZone, Promotion } from "../types";
import { RESTAURANT } from "../config/restaurant";

/**
 * The pricing engine decides what customers are charged, so it is the one part
 * of the foundation covered by tests from day one. Each case below pins down a
 * rule that would otherwise be easy to break silently during a refactor.
 */

const line = (unitPrice: number, quantity = 1): CartLine => ({
  lineId: `line-${unitPrice}-${quantity}`,
  menuItemId: "itm-test",
  slug: "test",
  name: "Test",
  imageSrc: "/menu/test.jpg",
  basePrice: unitPrice,
  selections: [],
  unitPrice,
  quantity,
});

const zone: DeliveryZone = {
  id: "zone-test",
  name: "Test Zone",
  postalCodes: ["10969"],
  deliveryFee: 299,
  minimumOrder: 1000,
  estimatedMinutes: 25,
};

const promo = (overrides: Partial<Promotion>): Promotion => ({
  code: "TEST",
  kind: "percentage",
  value: 10,
  description: "Test promo",
  minimumSubtotal: 0,
  appliesTo: "all",
  active: true,
  ...overrides,
});

describe("calculateTotals", () => {
  it("multiplies unit price by quantity", () => {
    const totals = calculateTotals({
      lines: [line(1500, 2), line(700)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: null,
    });
    expect(totals.subtotal).toBe(3700);
  });

  it("charges no delivery fee for pickup", () => {
    const totals = calculateTotals({
      lines: [line(1000)],
      fulfillmentType: "pickup",
      zone,
      promotion: null,
    });
    expect(totals.deliveryFee).toBe(0);
  });

  it("charges the zone fee for delivery below the free threshold", () => {
    const totals = calculateTotals({
      lines: [line(2000)],
      fulfillmentType: "delivery",
      zone,
      promotion: null,
    });
    expect(totals.deliveryFee).toBe(299);
  });

  it("waives delivery at or above the free-delivery threshold", () => {
    const totals = calculateTotals({
      lines: [line(RESTAURANT.fees.freeDeliveryThreshold)],
      fulfillmentType: "delivery",
      zone,
      promotion: null,
    });
    expect(totals.deliveryFee).toBe(0);
  });

  it("waives delivery for a free-delivery promotion", () => {
    const totals = calculateTotals({
      lines: [line(2000)],
      fulfillmentType: "delivery",
      zone,
      promotion: promo({ kind: "free-delivery", value: 0 }),
    });
    expect(totals.deliveryFee).toBe(0);
    // A free-delivery code discounts the fee, never the food.
    expect(totals.discount).toBe(0);
  });

  it("applies a percentage discount to the subtotal only", () => {
    const totals = calculateTotals({
      lines: [line(2000)],
      fulfillmentType: "delivery",
      zone,
      promotion: promo({ kind: "percentage", value: 10 }),
    });
    expect(totals.discount).toBe(200);
    expect(totals.deliveryFee).toBe(299);
  });

  it("never discounts more than the subtotal", () => {
    const totals = calculateTotals({
      lines: [line(500)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "fixed", value: 5000 }),
    });
    expect(totals.discount).toBe(500);
    expect(totals.total).toBe(0);
  });

  it("never produces a negative total", () => {
    const totals = calculateTotals({
      lines: [line(100)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "fixed", value: 999_999 }),
    });
    expect(totals.total).toBeGreaterThanOrEqual(0);
  });

  it("reports VAT as a portion of the total, never added on top", () => {
    // Menu prices are VAT-inclusive, so a 10,00 € pickup order costs exactly
    // 10,00 € and the tax line describes what is already inside it.
    const totals = calculateTotals({
      lines: [line(1000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: null,
    });
    expect(totals.total).toBe(1000);
    expect(totals.tax).toBeLessThan(totals.total);
    expect(totals.tax).toBe(Math.round((1000 * 19) / 119));
  });

  it("shrinks the VAT line when a discount shrinks the total", () => {
    const full = calculateTotals({
      lines: [line(10_000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: null,
    });
    const halved = calculateTotals({
      lines: [line(10_000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 50 }),
    });
    // Computed from the halved total directly. Comparing against half of the
    // full VAT would be off by a cent, because each is rounded once.
    expect(halved.tax).toBe(Math.round((5000 * 19) / 119));
    expect(halved.tax).toBeLessThan(full.tax);
  });

  it("keeps every component an integer number of cents", () => {
    const totals = calculateTotals({
      lines: [line(1333, 3)],
      fulfillmentType: "delivery",
      zone,
      promotion: promo({ kind: "percentage", value: 17 }),
    });
    for (const value of Object.values(totals)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("produces a total its own components add up to", () => {
    const totals = calculateTotals({
      lines: [line(1899, 2), line(650)],
      fulfillmentType: "delivery",
      zone,
      promotion: promo({ kind: "percentage", value: 15 }),
    });
    // Tax is inside the total, not added to it.
    expect(totals.total).toBe(
      totals.subtotal - totals.discount + totals.deliveryFee,
    );
  });

  it("returns zeroes for an empty cart", () => {
    const totals = calculateTotals({
      lines: [],
      fulfillmentType: "delivery",
      zone,
      promotion: null,
    });
    expect(totals).toEqual({
      subtotal: 0,
      discount: 0,
      deliveryFee: 299,
      tax: Math.round((299 * 19) / 119),
      total: 299,
    });
  });
});

describe("the flat delivery fee", () => {
  it("applies before a postal code is known, rather than reading as free", () => {
    const totals = calculateTotals({
      lines: [line(1000)],
      fulfillmentType: "delivery",
      zone: null,
      promotion: null,
    });
    expect(totals.deliveryFee).toBe(RESTAURANT.fees.deliveryFee);
  });

  it("is overridden by a matched zone", () => {
    const pricier: DeliveryZone = { ...zone, deliveryFee: 449 };
    const totals = calculateTotals({
      lines: [line(1000)],
      fulfillmentType: "delivery",
      zone: pricier,
      promotion: null,
    });
    expect(totals.deliveryFee).toBe(449);
  });

  it("still charges nothing for pickup, zone or not", () => {
    for (const z of [null, zone]) {
      expect(
        calculateTotals({
          lines: [line(1000)],
          fulfillmentType: "pickup",
          zone: z,
          promotion: null,
        }).deliveryFee,
      ).toBe(0);
    }
  });

  it("is waived by the free-delivery threshold even with no zone", () => {
    const totals = calculateTotals({
      lines: [line(RESTAURANT.fees.freeDeliveryThreshold)],
      fulfillmentType: "delivery",
      zone: null,
      promotion: null,
    });
    expect(totals.deliveryFee).toBe(0);
  });
});

describe("discounts cannot be double-counted", () => {
  it("applies a percentage once, not once per line", () => {
    const totals = calculateTotals({
      lines: [line(1000), line(1000), line(1000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 20 }),
    });
    expect(totals.subtotal).toBe(3000);
    expect(totals.discount).toBe(600);
  });

  it("gives the same answer for one line of three as three lines of one", () => {
    const asOneLine = calculateTotals({
      lines: [line(1000, 3)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 20 }),
    });
    const asThreeLines = calculateTotals({
      lines: [line(1000), line(1000), line(1000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 20 }),
    });
    expect(asOneLine).toEqual(asThreeLines);
  });

  it("is a pure function of its inputs — recomputing never compounds", () => {
    const input = {
      lines: [line(1995, 2)],
      fulfillmentType: "delivery" as const,
      zone,
      promotion: promo({ kind: "percentage", value: 20 }),
    };
    const first = calculateTotals(input);
    const again = calculateTotals(input);
    const third = calculateTotals(input);
    expect(again).toEqual(first);
    expect(third).toEqual(first);
  });

  it("rounds a 20% discount on an odd subtotal to the nearest cent", () => {
    const totals = calculateTotals({
      lines: [line(1395)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 20 }),
    });
    // 1395 * 0.20 = 279 exactly.
    expect(totals.discount).toBe(279);
    expect(totals.total).toBe(1116);
  });

  it("rounds rather than truncates a fractional discount", () => {
    const totals = calculateTotals({
      lines: [line(999)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 20 }),
    });
    // 999 * 0.20 = 199.8 -> 200
    expect(totals.discount).toBe(200);
  });
});

describe("deliveryShortfall", () => {
  it("reports how far below a zone minimum the basket is", () => {
    expect(deliveryShortfall([line(600)], "delivery", zone)).toBe(400);
  });

  it("is zero once the basket qualifies", () => {
    expect(deliveryShortfall([line(1000)], "delivery", zone)).toBe(0);
  });

  it("does not apply to pickup", () => {
    expect(deliveryShortfall([line(100)], "pickup", zone)).toBe(0);
  });
});
