import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { menuWasModified, resetTestDatabase } from "./test-support";
import { getDb } from "./client";
import * as t from "./schema";
import { claimDelivery, saveOrder, getOrder, listOrders } from "../order/order-repository";
import { createRole, createStaff, listRoles, signIn, staffForToken } from "../staff/staff-repository";
import type { Order } from "../types";

/**
 * The properties that only a real database can have.
 *
 * These are integration tests against Postgres on purpose: "an order survives a
 * restart" and "two drivers cannot both claim one delivery" are not properties
 * a fake can demonstrate, and a fake that passed while Postgres failed would be
 * worse than no test at all.
 */

const anOrder = (reference: string, type: "delivery" | "pickup" = "delivery"): Order => ({
  id: `ord_${reference}`,
  reference,
  createdAt: new Date().toISOString(),
  customer: { name: "Ada L", email: `${reference.toLowerCase()}@example.com`, phone: "+31612345678" },
  fulfillment: {
    type,
    timing: "asap",
    ...(type === "delivery"
      ? { address: { street: "Borniastraat", houseNumber: "12", postalCode: "8934AB", city: "Leeuwarden" } }
      : {}),
  },
  lines: [
    {
      lineId: "line-1",
      menuItemId: "itm-classic",
      slug: "urban-classic",
      name: "Urban Classic Burger",
      imageSrc: "/menu/urban-classic.jpg",
      basePrice: 1395,
      selections: [
        { groupId: "grp-cook", groupName: "Cook", optionId: "opt-cook-medium", name: "Medium", priceDelta: 0 },
      ],
      unitPrice: 1395,
      quantity: 2,
      notes: "no pickles",
    },
  ],
  totals: { subtotal: 2790, discount: 0, deliveryFee: 299, tax: 493, total: 3089 },
  status: "confirmed",
  history: [{ status: "confirmed", at: new Date().toISOString(), by: "system" }],
  payment: {
    provider: "mock",
    status: "succeeded",
    reference: "pay_test",
    amount: 3089,
    processedAt: new Date().toISOString(),
  },
  estimatedReadyAt: new Date(Date.now() + 30 * 60000).toISOString(),
});

beforeEach(async () => resetTestDatabase());

describe("an order, written and read back", () => {
  it("survives being read by a completely separate query", async () => {
    await saveOrder(anOrder("UT-PERS1"));
    const found = await getOrder("UT-PERS1");
    expect(found?.reference).toBe("UT-PERS1");
    expect(found?.totals.total).toBe(3089);
  });

  it("keeps every part of the graph", async () => {
    await saveOrder(anOrder("UT-PERS2"));
    const found = await getOrder("UT-PERS2");
    expect(found?.customer.email).toBe("ut-pers2@example.com");
    expect(found?.fulfillment.address?.postalCode).toBe("8934AB");
    expect(found?.lines[0].quantity).toBe(2);
    expect(found?.lines[0].notes).toBe("no pickles");
    expect(found?.lines[0].selections[0].name).toBe("Medium");
    expect(found?.payment.reference).toBe("pay_test");
    expect(found?.history).toHaveLength(1);
  });

  it("keeps what was paid even after the menu is re-priced", async () => {
    menuWasModified();
    await saveOrder(anOrder("UT-PERS3"));
    // The dish costs a euro more from now on.
    await getDb()
      .update(t.menuItems)
      .set({ basePrice: 1495, name: "Urban Classic Burger (new recipe)" })
      .where(eq(t.menuItems.id, "itm-classic"));

    const found = await getOrder("UT-PERS3");
    expect(found?.lines[0].basePrice).toBe(1395);
    expect(found?.lines[0].name).toBe("Urban Classic Burger");
    expect(found?.totals.total).toBe(3089);
  });

  it("keeps the receipt when the dish is deleted from the menu entirely", async () => {
    menuWasModified();
    await saveOrder(anOrder("UT-PERS4"));
    await getDb().delete(t.menuItems).where(eq(t.menuItems.id, "itm-classic"));

    const found = await getOrder("UT-PERS4");
    expect(found?.lines[0].name).toBe("Urban Classic Burger");
    expect(found?.lines[0].basePrice).toBe(1395);
    // The reference back to the menu is gone; the snapshot is not.
    expect(found?.lines[0].menuItemId).toBe("");
  });

  it("lists newest first", async () => {
    const older = { ...anOrder("UT-OLD"), createdAt: new Date(Date.now() - 60_000).toISOString() };
    await saveOrder(older);
    await saveOrder(anOrder("UT-NEW"));
    const all = await listOrders();
    expect(all[0].reference).toBe("UT-NEW");
  });
});

describe("two drivers claiming one delivery", () => {
  const twoDrivers = async () => {
    const roles = await listRoles();
    const driverRole = roles.find((role) => role.name.includes("Delivery"))!;
    const made = [];
    for (const name of ["driver.one", "driver.two"]) {
      const result = await createStaff({
        username: name,
        name,
        password: "a-long-enough-password",
        roleIds: [driverRole.id],
      });
      if (!result.ok) throw new Error(result.error);
      made.push(result.value.id);
    }
    return made;
  };

  it("lets exactly one of two simultaneous claims win", async () => {
    const [a, b] = await twoDrivers();
    await saveOrder(anOrder("UT-RACE1"));

    const results = await Promise.all([
      claimDelivery("UT-RACE1", a),
      claimDelivery("UT-RACE1", b),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);

    const order = await getOrder("UT-RACE1");
    expect([a, b]).toContain(order?.assignedStaffId);
  });

  it("records exactly one assignment however many claims arrive at once", async () => {
    const [a, b] = await twoDrivers();
    await saveOrder(anOrder("UT-RACE2"));

    // Twenty at once, alternating between two drivers.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => claimDelivery("UT-RACE2", i % 2 === 0 ? a : b)),
    );

    const rows = await getDb()
      .select()
      .from(t.deliveryAssignments)
      .where(eq(t.deliveryAssignments.orderId, "ord_UT-RACE2"));
    expect(rows).toHaveLength(1);

    const order = await getOrder("UT-RACE2");
    expect(order?.assignedStaffId).toBe(rows[0].staffId);
  });

  it("is idempotent for the driver who already holds it", async () => {
    const [a] = await twoDrivers();
    await saveOrder(anOrder("UT-RACE3"));
    const first = await claimDelivery("UT-RACE3", a);
    const second = await claimDelivery("UT-RACE3", a);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it("refuses a pickup order, which has nothing to deliver", async () => {
    const [a] = await twoDrivers();
    await saveOrder(anOrder("UT-RACE4", "pickup"));
    const result = await claimDelivery("UT-RACE4", a);
    expect(result.ok).toBe(false);
  });
});

describe("staff data", () => {
  it("keeps a custom role and the account that holds it", async () => {
    const role = await createRole({
      name: "Night Shift",
      description: "Custom",
      permissions: ["orders.view", "orders.status.ready"],
    });
    expect(role.ok).toBe(true);
    if (!role.ok) return;

    const account = await createStaff({
      username: "night.person",
      name: "Night Person",
      password: "a-long-enough-password",
      roleIds: [role.value.id],
    });
    expect(account.ok).toBe(true);
    if (!account.ok) return;

    // Read back through a separate query path, as a new process would.
    const roles = await listRoles();
    const found = roles.find((r) => r.id === role.value.id);
    expect(found?.permissions).toEqual(["orders.status.ready", "orders.view"]);

    const session = await signIn("night.person", "a-long-enough-password");
    expect(session).not.toBeNull();
    const resolved = await staffForToken(session!.token);
    expect(resolved?.id).toBe(account.value.id);
    expect(resolved?.roleIds).toContain(role.value.id);
  });
});
