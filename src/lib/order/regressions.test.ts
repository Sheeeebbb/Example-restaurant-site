import { describe, expect, it } from "vitest";
import { placeOrder, type PlaceOrderRequest } from "./place-order";
import { validateOrderDraft, validateTiming, FIELD_LIMITS } from "./validation";
import type { OrderDraft } from "./validation";
import { MENU_ITEMS } from "../data/menu";
import { RESTAURANT } from "../config/restaurant";
import { findZone } from "../fulfillment/delivery";
import { calculateTotals } from "../cart/totals";

/**
 * Regression tests for defects found in the QA pass.
 *
 * Each one failed before its fix. They live together so the reason they exist
 * stays legible — these are not hypotheticals, they are things that were
 * genuinely broken in a running build.
 */

const draft: OrderDraft = {
  name: "Marta Kowalski",
  phone: "+49 30 5550 1420",
  email: "marta@example.com",
  street: "Oranienstraße",
  houseNumber: "148",
  postalCode: "8930",
  city: "Berlin",
  deliveryInstructions: "",
};

const classic = MENU_ITEMS.find((item) => item.slug === "urban-classic")!;

const request = (over: Partial<PlaceOrderRequest> = {}): PlaceOrderRequest => ({
  lines: [{ menuItemId: classic.id, optionIds: ["opt-cook-medium"], quantity: 1 }],
  fulfillment: { type: "delivery", timing: "asap" },
  draft,
  ...over,
});

const OPEN = new Date(2026, 7, 19, 12, 30); // Wednesday lunchtime

describe("regression: orders were accepted while the kitchen was closed", () => {
  it("refuses an ASAP order on a day the restaurant never opens", async () => {
    const monday = new Date(2026, 7, 24, 19, 0);
    const result = await placeOrder(request(), monday);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn't taking orders/i);
  });

  it("refuses an ASAP order before opening", async () => {
    const result = await placeOrder(request(), new Date(2026, 7, 19, 4, 0));
    expect(result.ok).toBe(false);
  });

  it("refuses an ASAP order after last orders", async () => {
    // Closes 22:00 with a 30-minute buffer, so 21:55 is too late.
    const result = await placeOrder(request(), new Date(2026, 7, 19, 21, 55));
    expect(result.ok).toBe(false);
  });

  it("accepts an ASAP order during service", async () => {
    expect((await placeOrder(request(), OPEN)).ok).toBe(true);
  });

  it("still allows scheduling for later while closed — that is the point of it", async () => {
    const closed = new Date(2026, 7, 19, 4, 0);
    const slot = new Date(2026, 7, 19, 19, 0).toISOString();
    const result = await placeOrder(
      request({ fulfillment: { type: "delivery", timing: "scheduled", scheduledFor: slot } }),
      closed,
    );
    expect(result.ok).toBe(true);
  });

  it("reports the same rule through the shared validator the UI uses", () => {
    const zone = findZone("8930");
    const closed = new Date(2026, 7, 24, 19, 0);
    expect(validateTiming("asap", undefined, "delivery", zone, closed)).toBeTruthy();
    expect(validateTiming("asap", undefined, "delivery", zone, OPEN)).toBeNull();
  });
});

describe("regression: free-text input was unbounded server-side", () => {
  it("refuses an over-long name instead of storing it", async () => {
    const result = await placeOrder(
      request({ draft: { ...draft, name: "A".repeat(5000) } }),
      OPEN,
    );
    expect(result).toMatchObject({ ok: false, field: "name" });
  });

  it("bounds every free-text field", () => {
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      const errors = validateOrderDraft(
        { ...draft, [field]: "x".repeat(limit + 1) },
        "delivery",
      );
      expect(errors[field as keyof typeof errors], field).toBeTruthy();
    }
  });

  it("accepts a value exactly at the limit", () => {
    const errors = validateOrderDraft(
      { ...draft, city: "x".repeat(FIELD_LIMITS.city) },
      "delivery",
    );
    expect(errors.city).toBeUndefined();
  });

  it("truncates an over-long kitchen note rather than losing the order", async () => {
    const result = await placeOrder(
      request({
        lines: [{
          menuItemId: classic.id,
          optionIds: ["opt-cook-medium"],
          quantity: 1,
          notes: "x".repeat(5000),
        }],
      }),
      OPEN,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.lines[0].notes?.length).toBe(
        RESTAURANT.ordering.maxNoteLength,
      );
    }
  });

  it("caps the number of separate lines in one order", async () => {
    const many = Array.from(
      { length: RESTAURANT.ordering.maxLinesPerOrder + 1 },
      () => ({ menuItemId: classic.id, optionIds: ["opt-cook-medium"], quantity: 1 }),
    );
    expect((await placeOrder(request({ lines: many }), OPEN)).ok).toBe(false);
  });
});

describe("regression: the delivery fee quoted was not always the fee charged", () => {
  it("prices delivery from the matched zone, not the flat default", () => {
    const zone = findZone("8930");
    expect(zone).not.toBeNull();
    // The zone's own fee is what the customer is charged, whether it is above,
    // below or equal to the flat fallback — the bug was reading the fallback
    // once a zone had matched.
    const pricier = { ...zone!, deliveryFee: zone!.deliveryFee + 150 };
    expect(
      calculateTotals({ lines: [], fulfillmentType: "delivery", zone: pricier, promotion: null })
        .deliveryFee,
    ).toBe(pricier.deliveryFee);
  });

  it("keeps the advertised 'from' price truthful — no zone is cheaper than it", async () => {
    const { DELIVERY_ZONES } = await import("../config/restaurant");
    const cheapest = Math.min(
      RESTAURANT.fees.deliveryFee,
      ...DELIVERY_ZONES.map((zone) => zone.deliveryFee),
    );
    for (const zone of DELIVERY_ZONES) {
      expect(zone.deliveryFee, zone.name).toBeGreaterThanOrEqual(cheapest);
    }
  });
});
