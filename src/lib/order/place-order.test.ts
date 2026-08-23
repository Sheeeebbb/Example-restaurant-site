import { describe, expect, it } from "vitest";
import { placeOrder, type PlaceOrderRequest } from "./place-order";
import { MENU_ITEMS } from "../data/menu";
import type { OrderDraft } from "./validation";

// A Wednesday lunchtime, comfortably inside opening hours.
const NOW = new Date(2026, 7, 19, 12, 0);

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

const classic = MENU_ITEMS.find((i) => i.slug === "urban-classic")!;
const water = MENU_ITEMS.find((i) => i.slug === "spring-water")!;
const soldOut = MENU_ITEMS.find((i) => !i.available)!;

const request = (over: Partial<PlaceOrderRequest> = {}): PlaceOrderRequest => ({
  lines: [
    {
      menuItemId: classic.id,
      optionIds: ["opt-cook-medium", "opt-ex-bacon"],
      quantity: 2,
      notes: "no pickles",
    },
  ],
  fulfillment: { type: "delivery", timing: "asap" },
  draft,
  ...over,
});

describe("placeOrder — the happy path", () => {
  it("creates an order with a reference, lines and totals", async () => {
    const result = await placeOrder(request(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { order } = result;
    expect(order.reference).toMatch(/^UT-[A-Z0-9]{5}$/);
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0].quantity).toBe(2);
    expect(order.lines[0].notes).toBe("no pickles");
    expect(order.status).toBe("confirmed");
    expect(order.history).toHaveLength(1);
    expect(order.payment.status).toBe("succeeded");
    expect(order.customer.name).toBe("Marta Kowalski");
  });

  it("prices from the menu, not from anything the client sends", async () => {
    const result = await placeOrder(request(), NOW);
    if (!result.ok) throw new Error("expected success");

    // 13,95 base + 2,00 bacon = 15,95 each.
    expect(result.order.lines[0].unitPrice).toBe(classic.basePrice + 200);
    expect(result.order.totals.subtotal).toBe((classic.basePrice + 200) * 2);
  });

  it("ignores a price the client tries to smuggle in", async () => {
    const tampered = {
      ...request(),
      // None of these fields exist in PlaceOrderRequest; a hostile client can
      // still put them on the wire, so this proves they are never read.
      total: 1,
      lines: [
        {
          menuItemId: classic.id,
          optionIds: ["opt-cook-medium"],
          quantity: 1,
          unitPrice: 1,
          basePrice: 1,
        },
      ],
    } as unknown as PlaceOrderRequest;

    const result = await placeOrder(tampered, NOW);
    if (!result.ok) throw new Error("expected success");

    expect(result.order.lines[0].unitPrice).toBe(classic.basePrice);
    expect(result.order.totals.total).toBeGreaterThan(classic.basePrice);
    expect(result.order.payment.amount).toBe(result.order.totals.total);
  });

  it("charges the payment provider exactly the recomputed total", async () => {
    const result = await placeOrder(request(), NOW);
    if (!result.ok) throw new Error("expected success");
    expect(result.order.payment.amount).toBe(result.order.totals.total);
  });

  it("applies a valid promotional code", async () => {
    const result = await placeOrder(
      request({ promotionCode: "WELCOME20" }),
      NOW,
    );
    if (!result.ok) throw new Error("expected success");

    const subtotal = (classic.basePrice + 200) * 2;
    expect(result.order.promotionCode).toBe("WELCOME20");
    expect(result.order.totals.discount).toBe(Math.round(subtotal * 0.2));
  });

  it("silently drops a code that no longer qualifies rather than failing", async () => {
    // PICKUP5 is pickup-only; this is a delivery order.
    const result = await placeOrder(request({ promotionCode: "PICKUP5" }), NOW);
    if (!result.ok) throw new Error("expected success");
    expect(result.order.promotionCode).toBeUndefined();
    expect(result.order.totals.discount).toBe(0);
  });

  it("omits the address on a pickup order and charges no delivery fee", async () => {
    const result = await placeOrder(
      request({ fulfillment: { type: "pickup", timing: "asap" } }),
      NOW,
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.order.fulfillment.address).toBeUndefined();
    expect(result.order.totals.deliveryFee).toBe(0);
  });

  it("records an address on a delivery order", async () => {
    const result = await placeOrder(request(), NOW);
    if (!result.ok) throw new Error("expected success");
    expect(result.order.fulfillment.address).toMatchObject({
      street: "Oranienstraße",
      houseNumber: "148",
      postalCode: "8930",
      city: "Berlin",
    });
  });

  it("sets a ready time in the future", async () => {
    const result = await placeOrder(request(), NOW);
    if (!result.ok) throw new Error("expected success");
    expect(new Date(result.order.estimatedReadyAt).getTime()).toBeGreaterThan(
      NOW.getTime(),
    );
  });

  it("gives two orders different references", async () => {
    const a = await placeOrder(request(), NOW);
    const b = await placeOrder(request(), NOW);
    if (!a.ok || !b.ok) throw new Error("expected success");
    expect(a.order.reference).not.toBe(b.order.reference);
    expect(a.order.id).not.toBe(b.order.id);
  });
});

describe("placeOrder — rejections", () => {
  it("refuses an empty cart", async () => {
    const result = await placeOrder(request({ lines: [] }), NOW);
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses an item that isn't on the menu", async () => {
    const result = await placeOrder(
      request({ lines: [{ menuItemId: "itm-nope", optionIds: [], quantity: 1 }] }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/no longer on the menu/i);
  });

  it("refuses a sold-out item", async () => {
    const result = await placeOrder(
      request({ lines: [{ menuItemId: soldOut.id, optionIds: [], quantity: 1 }] }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/sold out/i);
  });

  it("refuses a quantity beyond the per-line cap", async () => {
    const result = await placeOrder(
      request({
        lines: [{ menuItemId: classic.id, optionIds: ["opt-cook-medium"], quantity: 999 }],
      }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/at most/i);
  });

  it("refuses a zero or negative quantity", async () => {
    for (const quantity of [0, -3]) {
      const result = await placeOrder(
        request({
          lines: [{ menuItemId: classic.id, optionIds: ["opt-cook-medium"], quantity }],
        }),
        NOW,
      );
      expect(result, `quantity ${quantity}`).toMatchObject({ ok: false });
    }
  });

  it("refuses an item whose required option is missing", async () => {
    // Spring Water has a required group with no default.
    const result = await placeOrder(
      request({ lines: [{ menuItemId: water.id, optionIds: [], quantity: 1 }] }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/needs a choice/i);
  });

  it("refuses incomplete customer details, naming the field", async () => {
    const result = await placeOrder(
      request({ draft: { ...draft, email: "not-an-email" } }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, field: "email" });
  });

  it("refuses delivery to an uncovered postal code", async () => {
    const result = await placeOrder(
      request({ draft: { ...draft, postalCode: "9999" } }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, field: "postalCode" });
  });

  it("refuses a delivery order below the zone minimum", async () => {
    const fries = MENU_ITEMS.find((i) => i.slug === "buttermilk-slaw")!;
    const result = await placeOrder(
      request({
        lines: [{ menuItemId: fries.id, optionIds: ["opt-size-regular"], quantity: 1 }],
      }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/minimum for delivery/i);
  });

  it("refuses a scheduled slot that has passed", async () => {
    const result = await placeOrder(
      request({
        fulfillment: {
          type: "delivery",
          timing: "scheduled",
          scheduledFor: new Date(2026, 7, 19, 12, 5).toISOString(),
        },
      }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, field: "scheduledFor" });
  });

  it("refuses an unknown fulfilment type", async () => {
    const result = await placeOrder(
      request({ fulfillment: { type: "teleport" as "pickup", timing: "asap" } }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("does not create an order object when it rejects", async () => {
    const result = await placeOrder(request({ lines: [] }), NOW);
    expect("order" in result).toBe(false);
  });
});
