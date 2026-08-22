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
  postalCodes: ["30303"],
  deliveryFee: 499,
  minimumOrder: 1500,
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
    expect(totals.deliveryFee).toBe(499);
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
    expect(totals.deliveryFee).toBe(499);
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

  it("taxes the discounted subtotal, not the original", () => {
    const withoutPromo = calculateTotals({
      lines: [line(10_000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: null,
    });
    const withPromo = calculateTotals({
      lines: [line(10_000)],
      fulfillmentType: "pickup",
      zone: null,
      promotion: promo({ kind: "percentage", value: 50 }),
    });
    expect(withPromo.tax).toBe(Math.round(withoutPromo.tax / 2));
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
    expect(totals.total).toBe(
      totals.subtotal - totals.discount + totals.deliveryFee + totals.tax,
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
      deliveryFee: 499,
      tax: 0,
      total: 499,
    });
  });
});

describe("deliveryShortfall", () => {
  it("reports how far below a zone minimum the basket is", () => {
    expect(deliveryShortfall([line(1000)], "delivery", zone)).toBe(500);
  });

  it("is zero once the basket qualifies", () => {
    expect(deliveryShortfall([line(1500)], "delivery", zone)).toBe(0);
  });

  it("does not apply to pickup", () => {
    expect(deliveryShortfall([line(100)], "pickup", zone)).toBe(0);
  });
});
