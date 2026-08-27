import { beforeEach, describe, expect, it } from "vitest";
import { calculateStats } from "./stats";
import {
  createMenuItem,
  deleteMenuItem,
  setMenuItemAvailability,
  updateMenuItem,
  type MenuItemInput,
} from "./menu-admin";
import { looksLikeSessionToken, shouldUseSecureCookie } from "./auth";
import { resetStore } from "../server/store";
import { getMenuItemBySlug, getMenuItems } from "../data/repository";
import {
  getOrder,
  listOrders,
  saveOrder,
  advanceOrder,
  cancelOrder,
  revertOrder,
  transitionOrder,
} from "../order/order-repository";
import { deriveStatus } from "../order/status";
import { isBackwards } from "../order/transitions";
import type { Order } from "../types";

const NOW = new Date(2026, 7, 22, 19, 0);

const order = (over: Partial<Order> = {}): Order => ({
  id: `ord_${Math.random()}`,
  reference: `UT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  createdAt: NOW.toISOString(),
  customer: { name: "Marta K", email: "m@example.com", phone: "+493055501420" },
  fulfillment: { type: "delivery", timing: "asap" },
  lines: [],
  totals: { subtotal: 2000, discount: 0, deliveryFee: 199, tax: 350, total: 2199 },
  status: "confirmed",
  history: [{ status: "confirmed", at: NOW.toISOString(), by: "system" }],
  payment: {
    provider: "mock",
    status: "succeeded",
    reference: "mock_x",
    amount: 2199,
    processedAt: NOW.toISOString(),
  },
  estimatedReadyAt: new Date(NOW.getTime() + 40 * 60_000).toISOString(),
  ...over,
});

beforeEach(() => resetStore());

describe("dashboard stats", () => {
  it("counts today's orders and revenue", () => {
    const stats = calculateStats([order(), order()], NOW);
    expect(stats.ordersToday).toBe(2);
    expect(stats.revenueToday).toBe(4398);
    expect(stats.averageOrderValue).toBe(2199);
  });

  it("ignores orders from other days", () => {
    const yesterday = order({
      createdAt: new Date(2026, 7, 21, 19, 0).toISOString(),
    });
    const stats = calculateStats([order(), yesterday], NOW);
    expect(stats.ordersToday).toBe(1);
    expect(stats.revenueToday).toBe(2199);
  });

  it("counts a cancelled order but takes no revenue from it", () => {
    const cancelled = order({ status: "cancelled" });
    const stats = calculateStats([order(), cancelled], NOW);
    expect(stats.ordersToday).toBe(2);
    expect(stats.revenueToday).toBe(2199);
  });

  it("returns zeroes for a quiet day rather than dividing by zero", () => {
    expect(calculateStats([], NOW)).toMatchObject({
      ordersToday: 0,
      revenueToday: 0,
      averageOrderValue: 0,
    });
  });

  it("separates pickup orders awaiting collection from deliveries en route", () => {
    const ready = (type: "pickup" | "delivery") =>
      order({
        fulfillment: { type, timing: "asap" },
        status: "ready",
        history: [
          { status: "confirmed", at: NOW.toISOString(), by: "system" },
          { status: "ready", at: NOW.toISOString(), by: "staff" },
        ],
      });
    const stats = calculateStats([ready("pickup"), ready("delivery")], NOW);
    expect(stats.awaitingPickup).toBe(1);
    expect(stats.awaitingDriver).toBe(1);
  });

  it("reflects simulated progress on orders staff have not touched", () => {
    // 20 minutes into a 40-minute window, an untouched order is "preparing".
    const midway = new Date(NOW.getTime() + 20 * 60_000);
    expect(calculateStats([order()], midway).preparing).toBe(1);
  });
});

describe("order repository", () => {
  it("stores and returns an order by reference", async () => {
    const saved = await saveOrder(order({ reference: "UT-AAAAA" }));
    expect(saved.reference).toBe("UT-AAAAA");
    expect((await getOrder("UT-AAAAA"))?.reference).toBe("UT-AAAAA");
  });

  it("returns null for an unknown reference", async () => {
    expect(await getOrder("UT-ZZZZZ")).toBeNull();
  });

  it("lists newest first", async () => {
    await saveOrder(order({ reference: "UT-OLD", createdAt: new Date(2026, 7, 22, 10).toISOString() }));
    await saveOrder(order({ reference: "UT-NEW", createdAt: new Date(2026, 7, 22, 18).toISOString() }));
    expect((await listOrders()).map((o) => o.reference)).toEqual(["UT-NEW", "UT-OLD"]);
  });

  it("hands out copies, so a caller cannot mutate the store", async () => {
    await saveOrder(order({ reference: "UT-COPY" }));
    const fetched = await getOrder("UT-COPY");
    fetched!.status = "cancelled";
    expect((await getOrder("UT-COPY"))?.status).toBe("confirmed");
  });

  it("records a staff status change in the history", async () => {
    await saveOrder(order({ reference: "UT-HIST" }));
    const result = await advanceOrder("UT-HIST");

    expect(result.ok).toBe(true);
    const updated = result.ok ? result.order : null;
    expect(updated?.status).toBe("preparing");
    expect(updated?.history).toHaveLength(2);
    expect(updated?.history.at(-1)).toMatchObject({ status: "preparing", by: "staff" });
  });

  it("makes a staff status override the clock simulation", async () => {
    await saveOrder(order({ reference: "UT-OVER" }));
    await advanceOrder("UT-OVER");
    const result = await advanceOrder("UT-OVER");
    const updated = result.ok ? result.order : null;

    // Two minutes in, the simulation would still say "confirmed".
    const soon = new Date(NOW.getTime() + 2 * 60_000);
    expect(deriveStatus(updated!, soon)).toBe("ready");
  });

  /**
   * The rules, tested where they are ENFORCED rather than where they are
   * declared. `transitions.test.ts` proves the machine says the right thing;
   * these prove nothing can write to the store without asking it — which is the
   * claim that actually matters when the request arrives from somewhere other
   * than the button.
   */
  describe("one-way progression", () => {
    const place = async (reference: string, status: Order["status"] = "confirmed") =>
      saveOrder(order({ reference, status }));

    it("walks the full delivery path: received → preparing → ready → out for delivery → delivered", async () => {
      await place("UT-WALK");

      const seen: string[] = ["confirmed"];
      for (let step = 0; step < 4; step += 1) {
        const result = await advanceOrder("UT-WALK");
        expect(result.ok, `step ${step}`).toBe(true);
        if (result.ok) seen.push(result.order.status);
      }

      const path = ["confirmed", "preparing", "ready", "outForDelivery", "completed"];
      expect(seen).toEqual(path);
      expect((await getOrder("UT-WALK"))?.history.map((event) => event.status)).toEqual(
        path,
      );
      // One more press does nothing: the end is the end.
      expect((await advanceOrder("UT-WALK")).ok).toBe(false);
    });

    it("walks a collection along its own, shorter path", async () => {
      await saveOrder(
        order({
          reference: "UT-COLLECT",
          fulfillment: { type: "pickup", timing: "asap" },
        }),
      );

      const seen: string[] = ["confirmed"];
      for (let step = 0; step < 3; step += 1) {
        const result = await advanceOrder("UT-COLLECT");
        expect(result.ok, `step ${step}`).toBe(true);
        if (result.ok) seen.push(result.order.status);
      }

      expect(seen).toEqual(["confirmed", "preparing", "ready", "completed"]);
      expect((await advanceOrder("UT-COLLECT")).ok).toBe(false);
    });

    it("will not send a collection out for delivery, however it is asked", async () => {
      await saveOrder(
        order({
          reference: "UT-NOVAN",
          status: "ready",
          fulfillment: { type: "pickup", timing: "asap" },
        }),
      );

      const result = await transitionOrder("UT-NOVAN", "outForDelivery");
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.error).toMatch(/isn't a stage of a collection/i);
      expect((await getOrder("UT-NOVAN"))?.status).toBe("ready");
    });

    it("will not deliver an order that never left the restaurant", async () => {
      await place("UT-TELEPORT", "ready");

      const result = await transitionOrder("UT-TELEPORT", "completed");
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.error).toMatch(/out for delivery/i);
      expect((await getOrder("UT-TELEPORT"))?.status).toBe("ready");
    });

    it("refuses to skip a stage, however the request is phrased", async () => {
      await place("UT-SKIP");

      for (const target of ["ready", "completed"] as const) {
        const result = await transitionOrder("UT-SKIP", target);
        expect(result.ok, target).toBe(false);
        expect(result.ok ? "" : result.error).toMatch(/one step at a time/i);
      }
      // ...and the order did not move.
      expect((await getOrder("UT-SKIP"))?.status).toBe("confirmed");
    });

    it("refuses every backwards move made as an ordinary step", async () => {
      await place("UT-BACK", "ready");

      for (const target of ["preparing", "confirmed", "pending"] as const) {
        const result = await transitionOrder("UT-BACK", target);
        expect(result.ok, target).toBe(false);
        expect(result.ok ? "" : result.reason).toBe("invalid");
      }
      expect((await getOrder("UT-BACK"))?.status).toBe("ready");
      // Nothing refused was written to the audit trail either.
      expect((await getOrder("UT-BACK"))?.history).toHaveLength(1);
    });

    it("will not move a delivered order on, or cancel it, or step it back", async () => {
      await place("UT-DONE", "completed");

      for (const target of ["ready", "preparing", "confirmed", "cancelled"] as const) {
        expect((await transitionOrder("UT-DONE", target, { reason: "x" })).ok, target).toBe(
          false,
        );
      }
      expect((await advanceOrder("UT-DONE")).ok).toBe(false);
      expect((await getOrder("UT-DONE"))?.status).toBe("completed");
    });

    it("refuses an instruction aimed at a status the order has already left", async () => {
      await place("UT-RACE");
      await advanceOrder("UT-RACE"); // now preparing

      // A second tap on a button drawn when the order was still "confirmed".
      const stale = await advanceOrder("UT-RACE", "confirmed");
      expect(stale.ok).toBe(false);
      expect(stale.ok ? "" : stale.reason).toBe("conflict");
      // The refusal carries the truth, so a stale screen can right itself.
      expect(stale.ok ? null : stale.order?.status).toBe("preparing");
    });
  });

  describe("cancellation", () => {
    it("can be done from any stage before the order finishes", async () => {
      for (const from of ["confirmed", "preparing", "ready", "outForDelivery"] as const) {
        const reference = `UT-C${from.slice(0, 3).toUpperCase()}`;
        await saveOrder(order({ reference, status: from }));

        const result = await cancelOrder(reference, "An item is unavailable.");
        expect(result.ok, from).toBe(true);
        expect(result.ok ? result.order.status : null).toBe("cancelled");
      }
    });

    it("stores the reason and a timestamp on the order", async () => {
      await saveOrder(order({ reference: "UT-WHY", status: "preparing" }));
      const result = await cancelOrder("UT-WHY", "  The fryer has broken.  ");

      expect(result.ok).toBe(true);
      const cancelled = result.ok ? result.order : null;
      expect(cancelled?.cancellationReason).toBe("The fryer has broken.");
      expect(cancelled?.cancelledAt).toBeTruthy();
      expect(Number.isNaN(Date.parse(cancelled!.cancelledAt!))).toBe(false);

      // ...and in the audit trail too, against the event that ended the order.
      expect(cancelled?.history.at(-1)).toMatchObject({
        status: "cancelled",
        note: "The fryer has broken.",
        by: "staff",
      });
    });

    it("refuses to cancel without a reason — the customer is shown it", async () => {
      await saveOrder(order({ reference: "UT-MUTE" }));

      for (const reason of ["", "   "]) {
        const result = await cancelOrder("UT-MUTE", reason);
        expect(result.ok, JSON.stringify(reason)).toBe(false);
        expect(result.ok ? "" : result.error).toMatch(/reason/i);
      }
      expect((await getOrder("UT-MUTE"))?.status).toBe("confirmed");
    });

    it("is final — a cancelled order resumes into nothing", async () => {
      await saveOrder(order({ reference: "UT-GONE" }));
      await cancelOrder("UT-GONE", "Kitchen closing.");

      for (const target of [
        "confirmed",
        "preparing",
        "ready",
        "outForDelivery",
        "completed",
      ] as const) {
        const result = await transitionOrder("UT-GONE", target);
        expect(result.ok, target).toBe(false);
        expect(result.ok ? "" : result.error).toMatch(/cancelled/i);
      }
      expect((await advanceOrder("UT-GONE")).ok).toBe(false);

      const stored = await getOrder("UT-GONE");
      expect(stored?.status).toBe("cancelled");
      // The original reason survives every attempt to move it.
      expect(stored?.cancellationReason).toBe("Kitchen closing.");
    });

    it("cannot be cancelled twice", async () => {
      await saveOrder(order({ reference: "UT-TWICE" }));
      await cancelOrder("UT-TWICE", "First reason.");

      const second = await cancelOrder("UT-TWICE", "Second reason.");
      expect(second.ok).toBe(false);
      expect((await getOrder("UT-TWICE"))?.cancellationReason).toBe("First reason.");
    });

    it("leaves an ordinary advance with no cancellation fields", async () => {
      await saveOrder(order({ reference: "UT-CLEAN" }));
      const result = await advanceOrder("UT-CLEAN");
      const advanced = result.ok ? result.order : null;

      expect(advanced?.cancellationReason).toBeUndefined();
      expect(advanced?.cancelledAt).toBeUndefined();
      expect(advanced?.history.at(-1)?.note).toBeUndefined();
    });
  });

  it("reports 'not found' for an order that doesn't exist", async () => {
    const advanced = await advanceOrder("UT-NOPE");
    expect(advanced).toMatchObject({ ok: false, reason: "not-found" });
    expect(await transitionOrder("UT-NOPE", "ready")).toMatchObject({
      ok: false,
      reason: "not-found",
    });
    expect(await cancelOrder("UT-NOPE", "Closed.")).toMatchObject({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("menu management", () => {
  const input: MenuItemInput = {
    name: "Chilli Cheese Fries",
    description: "Fries, chilli, cheese sauce, jalapeños.",
    categoryId: "cat-sides",
    basePrice: 650,
    available: true,
    featured: false,
    tags: ["spicy"],
    allergens: ["milk"],
    kitchenMinutes: 8,
  };

  it("creates an item that appears on the customer menu", async () => {
    const result = await createMenuItem(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.item.slug).toBe("chilli-cheese-fries");
    expect(await getMenuItemBySlug("chilli-cheese-fries")).not.toBeNull();
  });

  it("gives a duplicate name a distinct slug rather than colliding", async () => {
    const first = await createMenuItem(input);
    const second = await createMenuItem(input);
    if (!first.ok || !second.ok) throw new Error("expected both to succeed");
    expect(second.item.slug).toBe(`${first.item.slug}-2`);
  });

  it("rejects an empty name, a bad category and a negative price", async () => {
    expect(await createMenuItem({ ...input, name: "  " })).toMatchObject({ ok: false, field: "name" });
    expect(await createMenuItem({ ...input, categoryId: "nope" })).toMatchObject({ ok: false, field: "categoryId" });
    expect(await createMenuItem({ ...input, basePrice: -1 })).toMatchObject({ ok: false, field: "basePrice" });
    expect(await createMenuItem({ ...input, basePrice: 12.5 })).toMatchObject({ ok: false, field: "basePrice" });
  });

  it("edits an item without changing its slug, so links keep working", async () => {
    const created = await createMenuItem(input);
    if (!created.ok) throw new Error("expected success");

    const updated = await updateMenuItem(created.item.id, {
      ...input,
      name: "Loaded Chilli Fries",
      basePrice: 750,
    });
    if (!updated.ok) throw new Error("expected success");

    expect(updated.item.name).toBe("Loaded Chilli Fries");
    expect(updated.item.basePrice).toBe(750);
    expect(updated.item.slug).toBe(created.item.slug);
  });

  it("keeps an edited item's option groups", async () => {
    const items = await getMenuItems();
    const burger = items.find((item) => item.slug === "urban-classic")!;
    expect(burger.optionGroups.length).toBeGreaterThan(0);

    const updated = await updateMenuItem(burger.id, {
      name: burger.name,
      description: burger.description,
      categoryId: burger.categoryId,
      basePrice: 1495,
      available: true,
      featured: burger.featured,
      tags: burger.tags,
      allergens: burger.allergens,
      kitchenMinutes: burger.kitchenMinutes,
    });
    if (!updated.ok) throw new Error("expected success");
    expect(updated.item.optionGroups).toHaveLength(burger.optionGroups.length);
    expect(updated.item.basePrice).toBe(1495);
  });

  it("marks an item unavailable without deleting it", async () => {
    const items = await getMenuItems();
    const burger = items.find((item) => item.slug === "urban-classic")!;

    await setMenuItemAvailability(burger.id, false);
    const after = await getMenuItemBySlug("urban-classic");
    expect(after?.available).toBe(false);
    expect(after).not.toBeNull();

    await setMenuItemAvailability(burger.id, true);
    expect((await getMenuItemBySlug("urban-classic"))?.available).toBe(true);
  });

  it("hides an unavailable item from an availableOnly query", async () => {
    const items = await getMenuItems();
    const burger = items.find((item) => item.slug === "urban-classic")!;
    await setMenuItemAvailability(burger.id, false);

    const available = await getMenuItems({ availableOnly: true });
    expect(available.some((item) => item.slug === "urban-classic")).toBe(false);
  });

  it("removes an item from the customer menu", async () => {
    const before = (await getMenuItems()).length;
    const items = await getMenuItems();
    const target = items.find((item) => item.slug === "craft-lemonade")!;

    expect(await deleteMenuItem(target.id)).toEqual({ ok: true });
    expect((await getMenuItems()).length).toBe(before - 1);
    expect(await getMenuItemBySlug("craft-lemonade")).toBeNull();
  });

  it("reports a missing item rather than failing silently", async () => {
    expect(await deleteMenuItem("itm-nope")).toMatchObject({ ok: false });
    expect(await setMenuItemAvailability("itm-nope", false)).toMatchObject({ ok: false });
  });

  it("does not leak edits into the factory menu", async () => {
    const items = await getMenuItems();
    await deleteMenuItem(items[0].id);
    resetStore();
    expect((await getMenuItems()).length).toBe(items.length);
  });
});

describe("the session cookie's shape check", () => {
  /*
   * `proxy.ts` uses this to decide where to send someone, and NOTHING else
   * uses it to decide anything. It cannot: a token of the right shape is not a
   * session, and only `staffForToken` can say whether one is — which is why
   * these tests assert the shape and say nothing about access.
   */
  it("recognises a real token's shape", () => {
    expect(looksLikeSessionToken("a".repeat(64))).toBe(true);
    expect(looksLikeSessionToken("0123456789abcdef".repeat(4))).toBe(true);
  });

  it("rejects anything that could not be one", () => {
    for (const value of [undefined, "", "staff-demo-session", "A".repeat(64), "a".repeat(63), "a".repeat(65)]) {
      expect(looksLikeSessionToken(value), String(value)).toBe(false);
    }
  });
});

/**
 * The dish photograph.
 *
 * One field, `item.image`, read by the menu card, the product panel, the cart
 * line and the kitchen ticket alike. These cover what has to be true of it when
 * staff change a dish — above all that an edit which says nothing about the
 * photograph leaves the photograph alone.
 */
describe("menu item photographs", () => {
  beforeEach(() => resetStore());

  const base = {
    name: "Test Dish",
    description: "For testing.",
    categoryId: "cat-burgers",
    basePrice: 1000,
    available: true,
    featured: false,
    tags: [],
    allergens: [],
    kitchenMinutes: 5,
  } satisfies MenuItemInput;

  it("saves a new dish with the photograph that was uploaded for it", async () => {
    const result = await createMenuItem({
      ...base,
      imageSrc: "/api/menu-image/test-abc.jpg",
      imageAlt: "A test dish",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.item.image).toEqual({
      src: "/api/menu-image/test-abc.jpg",
      alt: "A test dish",
    });
  });

  it("lets a new dish exist without one", async () => {
    const result = await createMenuItem(base);
    if (!result.ok) throw new Error(result.error);
    // A slug-shaped path that resolves to nothing: the card shows its fallback.
    expect(result.item.image.src).toBe("/menu/test-dish.jpg");
    expect(result.item.image.alt).toBe("Test Dish");
  });

  it("replaces the photograph when an edit carries a new one", async () => {
    const created = await createMenuItem(base);
    if (!created.ok) throw new Error(created.error);

    const updated = await updateMenuItem(created.item.id, {
      ...base,
      imageSrc: "/api/menu-image/new-photo.jpg",
    });
    if (!updated.ok) throw new Error(updated.error);
    expect(updated.item.image.src).toBe("/api/menu-image/new-photo.jpg");
  });

  it("keeps the photograph when an edit says nothing about it", async () => {
    const created = await createMenuItem({
      ...base,
      imageSrc: "/api/menu-image/original.jpg",
    });
    if (!created.ok) throw new Error(created.error);

    // This is what cancelling an image change sends: everything else, no image.
    const updated = await updateMenuItem(created.item.id, {
      ...base,
      basePrice: 1500,
    });
    if (!updated.ok) throw new Error(updated.error);
    expect(updated.item.image.src).toBe("/api/menu-image/original.jpg");
    expect(updated.item.basePrice).toBe(1500);
  });

  it("keeps the shipped photograph of an existing dish through an ordinary edit", async () => {
    const [existing] = await getMenuItems({ category: "burgers" });
    const before = existing.image.src;

    const updated = await updateMenuItem(existing.id, {
      name: existing.name,
      description: existing.description,
      categoryId: existing.categoryId,
      basePrice: existing.basePrice + 100,
      available: existing.available,
      featured: existing.featured,
      tags: existing.tags,
      allergens: existing.allergens,
      kitchenMinutes: existing.kitchenMinutes,
    });
    if (!updated.ok) throw new Error(updated.error);
    expect(updated.item.image.src).toBe(before);
  });

  it("refuses an image address that is not a path this site serves", async () => {
    for (const imageSrc of [
      "https://evil.example/x.jpg",
      "//evil.example/x.jpg",
      "/menu/../../etc/passwd",
      "javascript:alert(1)",
    ]) {
      const result = await createMenuItem({ ...base, imageSrc });
      expect(result.ok, imageSrc).toBe(false);
    }
  });
});

describe("the staff session cookie", () => {
  const request = (url: string, headers: Record<string, string> = {}) =>
    new Request(url, { headers });

  it("is Secure when the request came over HTTPS", () => {
    expect(shouldUseSecureCookie(request("https://urbantable.test/api"))).toBe(
      true,
    );
  });

  it("is Secure behind a proxy that terminated TLS at the edge", () => {
    expect(
      shouldUseSecureCookie(
        request("http://10.0.0.4/api", { "x-forwarded-proto": "https" }),
      ),
    ).toBe(true);
    // A chain of proxies appends; the client's own protocol is the first entry.
    expect(
      shouldUseSecureCookie(
        request("http://10.0.0.4/api", { "x-forwarded-proto": "https, http" }),
      ),
    ).toBe(true);
  });

  it("is not Secure on a plaintext connection, which would drop the cookie", () => {
    expect(shouldUseSecureCookie(request("http://192.168.1.5:3000/api"))).toBe(
      false,
    );
    expect(
      shouldUseSecureCookie(
        request("http://192.168.1.5:3000/api", { "x-forwarded-proto": "http" }),
      ),
    ).toBe(false);
  });
});

/**
 * Corrections, tested where they are ENFORCED.
 *
 * The claim that matters is not that a correction works — it is that ONLY a
 * correction works. A request that names an earlier status without asking for a
 * correction must be refused by the store, not merely left undrawn on a screen,
 * because the screen is not what a stale client or a hand-rolled call goes
 * through.
 */
describe("correcting a status backwards", () => {
  const at = async (reference: string, status: Order["status"], type: "delivery" | "pickup" = "delivery") =>
    saveOrder(
      order({ reference, status, fulfillment: { type, timing: "asap" } }),
    );

  it("walks back each of the four corrections staff make", async () => {
    const cases = [
      ["preparing", "confirmed"],
      ["ready", "preparing"],
      ["outForDelivery", "ready"],
      ["completed", "outForDelivery"],
    ] as const;

    for (const [from, to] of cases) {
      const reference = `UT-B${from.slice(0, 3).toUpperCase()}`;
      await at(reference, from);

      const result = await revertOrder(reference, to, from);
      expect(result.ok, `${from} -> ${to}`).toBe(true);
      expect(result.ok ? result.order.status : null, `${from} -> ${to}`).toBe(to);
      expect((await getOrder(reference))?.status, `${from} -> ${to}`).toBe(to);
    }
  });

  it("goes back more than one stage in a single correction", async () => {
    // Two quick taps put an order two stages ahead; one confirmation puts it
    // back, rather than making staff click through two.
    await at("UT-FAR", "completed");
    const result = await revertOrder("UT-FAR", "preparing", "completed");
    expect(result.ok).toBe(true);
    expect((await getOrder("UT-FAR"))?.status).toBe("preparing");
  });

  it("records the correction, including where it came from", async () => {
    await at("UT-TRAIL", "ready");
    await revertOrder("UT-TRAIL", "preparing", "ready", "  Marked by mistake.  ");

    const event = (await getOrder("UT-TRAIL"))?.history.at(-1);
    expect(event).toMatchObject({
      status: "preparing",
      from: "ready",
      note: "Marked by mistake.",
      by: "staff",
    });
    expect(Number.isNaN(Date.parse(event!.at))).toBe(false);
  });

  it("does not demand a note — a correction is usually 'wrong button'", async () => {
    await at("UT-QUIET", "ready");
    const result = await revertOrder("UT-QUIET", "preparing", "ready");
    expect(result.ok).toBe(true);
    expect((await getOrder("UT-QUIET"))?.history.at(-1)?.note).toBeUndefined();
  });

  it("records where it came from on a forward step too", async () => {
    /*
     * Every change a person makes carries its previous status, not only a
     * correction — so each line of the trail reads on its own rather than
     * needing the line above to make sense of it. Which of them were
     * corrections stays derivable from the two statuses, so there is no second
     * field that could disagree with the first.
     */
    await at("UT-MARK", "confirmed");
    await advanceOrder("UT-MARK");
    const forward = (await getOrder("UT-MARK"))?.history.at(-1);
    expect(forward).toMatchObject({ from: "confirmed", status: "preparing" });
    expect(isBackwards(forward!.from!, forward!.status, "delivery")).toBe(false);

    await revertOrder("UT-MARK", "confirmed", "preparing");
    const backward = (await getOrder("UT-MARK"))?.history.at(-1);
    expect(backward).toMatchObject({ from: "preparing", status: "confirmed" });
    expect(isBackwards(backward!.from!, backward!.status, "delivery")).toBe(true);
  });

  it("records who did it, from what the caller passes as the actor", async () => {
    /*
     * The repository takes the actor as an argument; the ROUTE resolves it from
     * the session and never from the request body. That split is why this test
     * can pass an actor freely — it is not the thing under test here, and
     * `rbac.test.ts` plus the HTTP suite cover the part that is.
     */
    await at("UT-WHO", "confirmed");
    await advanceOrder("UT-WHO", undefined, {
      id: "staff_1",
      name: "John Smith",
      roles: ["Kitchen Staff"],
    });

    expect((await getOrder("UT-WHO"))?.history.at(-1)).toMatchObject({
      from: "confirmed",
      status: "preparing",
      actorId: "staff_1",
      actorName: "John Smith",
      actorRoles: ["Kitchen Staff"],
      by: "staff",
    });
  });

  it("leaves the opening event without a previous status or an actor", async () => {
    await at("UT-FIRST", "confirmed");
    const first = (await getOrder("UT-FIRST"))?.history[0];
    expect(first?.from).toBeUndefined();
    expect(first?.actorId).toBeUndefined();
  });

  it("refuses a correction aimed at a status the order has already left", async () => {
    await at("UT-STALE", "ready");
    await advanceOrder("UT-STALE"); // now out for delivery

    // A dialog opened when the order still read "ready".
    const stale = await revertOrder("UT-STALE", "preparing", "ready");
    expect(stale.ok).toBe(false);
    expect(stale.ok ? "" : stale.reason).toBe("conflict");
    expect(stale.ok ? null : stale.order?.status).toBe("outForDelivery");
    expect((await getOrder("UT-STALE"))?.status).toBe("outForDelivery");
  });

  it("refuses to move an order forwards", async () => {
    await at("UT-FWD", "preparing");
    const result = await revertOrder("UT-FWD", "completed", "preparing");
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/not behind preparing/i);
    expect((await getOrder("UT-FWD"))?.status).toBe("preparing");
  });

  it("cannot reinstate a cancelled order, and says why", async () => {
    await at("UT-REIN", "confirmed");
    await cancelOrder("UT-REIN", "Kitchen closing.");

    for (const target of ["confirmed", "preparing", "ready", "completed"] as const) {
      const result = await revertOrder("UT-REIN", target, "cancelled");
      expect(result.ok, target).toBe(false);
      expect(result.ok ? "" : result.error, target).toMatch(/cancelled and refunded/i);
    }

    const stored = await getOrder("UT-REIN");
    expect(stored?.status).toBe("cancelled");
    expect(stored?.cancellationReason).toBe("Kitchen closing.");
    expect(stored?.refund?.status).toBe("succeeded");
  });

  it("cannot be used to cancel — that has its own action and its own refund", async () => {
    await at("UT-SNEAK", "ready");
    const result = await revertOrder("UT-SNEAK", "cancelled", "ready");
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/use the cancel action/i);
    expect((await getOrder("UT-SNEAK"))?.status).toBe("ready");
    expect((await getOrder("UT-SNEAK"))?.refund).toBeUndefined();
  });

  it("will not send a collection back to a stage it never had", async () => {
    await at("UT-BPICK", "completed", "pickup");
    const result = await revertOrder("UT-BPICK", "outForDelivery", "completed");
    expect(result.ok).toBe(false);
    expect((await getOrder("UT-BPICK"))?.status).toBe("completed");
  });

  it("writes nothing at all when it refuses", async () => {
    await at("UT-NOWRITE", "preparing");
    const before = await getOrder("UT-NOWRITE");

    await revertOrder("UT-NOWRITE", "completed", "preparing");
    await revertOrder("UT-NOWRITE", "preparing", "preparing");
    await revertOrder("UT-NOWRITE", "cancelled", "preparing");

    const after = await getOrder("UT-NOWRITE");
    expect(after?.status).toBe(before?.status);
    expect(after?.history).toHaveLength(before!.history.length);
  });

  it("moves forward again afterwards, one step at a time", async () => {
    await at("UT-RESUME", "outForDelivery");
    await revertOrder("UT-RESUME", "preparing", "outForDelivery");

    const next = await advanceOrder("UT-RESUME");
    expect(next.ok && next.order.status).toBe("ready");
  });

  it("still refuses a skip after a correction", async () => {
    await at("UT-SKIPBACK", "completed");
    await revertOrder("UT-SKIPBACK", "confirmed", "completed");

    const skip = await transitionOrder("UT-SKIPBACK", "completed");
    expect(skip.ok).toBe(false);
    expect((await getOrder("UT-SKIPBACK"))?.status).toBe("confirmed");
  });
});
