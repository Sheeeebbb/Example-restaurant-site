import { describe, expect, it } from "vitest";
import { deriveStatus, statusLabel, timelineFor, timelineIndex } from "./status";
import {
  generateOrderReference,
  isValidReferenceShape,
  normalizeOrderReference,
} from "./reference";
import type { Order } from "../types";

const base = (
  type: "delivery" | "pickup",
  minutes: number,
): Pick<Order, "createdAt" | "estimatedReadyAt" | "fulfillment" | "status"> => ({
  createdAt: new Date(2026, 7, 22, 18, 0).toISOString(),
  estimatedReadyAt: new Date(2026, 7, 22, 18, minutes).toISOString(),
  fulfillment: { type, timing: "asap" },
  status: "confirmed",
});

const at = (minutes: number) => new Date(2026, 7, 22, 18, minutes);

describe("deriveStatus", () => {
  const delivery = base("delivery", 40);

  it("starts at 'received'", () => {
    expect(deriveStatus(delivery, at(0))).toBe("confirmed");
    expect(deriveStatus(delivery, at(2))).toBe("confirmed");
  });

  it("moves through preparing, ready, out for delivery, delivered", () => {
    expect(deriveStatus(delivery, at(10))).toBe("preparing");
    expect(deriveStatus(delivery, at(26))).toBe("ready");
    expect(deriveStatus(delivery, at(32))).toBe("outForDelivery");
    expect(deriveStatus(delivery, at(40))).toBe("completed");
    expect(deriveStatus(delivery, at(400))).toBe("completed");
  });

  it("never says 'out for delivery' on a pickup order", () => {
    const pickup = base("pickup", 40);
    const statuses = [0, 10, 26, 32, 39].map((m) => deriveStatus(pickup, at(m)));
    expect(statuses).not.toContain("outForDelivery");
    expect(statuses).toEqual(["confirmed", "preparing", "ready", "ready", "ready"]);
  });

  it("is stable — the same moment always gives the same status", () => {
    for (const minute of [0, 5, 15, 25, 35, 45]) {
      const first = deriveStatus(delivery, at(minute));
      expect(deriveStatus(delivery, at(minute))).toBe(first);
      expect(deriveStatus(delivery, at(minute))).toBe(first);
    }
  });

  it("keeps a cancelled order cancelled", () => {
    expect(deriveStatus({ ...delivery, status: "cancelled" }, at(10))).toBe("cancelled");
  });

  it("treats a zero-length window as complete rather than dividing by zero", () => {
    const instant = { ...delivery, estimatedReadyAt: delivery.createdAt };
    expect(deriveStatus(instant, at(0))).toBe("completed");
  });

  it("holds a scheduled order at 'received' until its window opens", () => {
    // Ordered at 18:00 for 21:00 — three hours out.
    const scheduled = base("delivery", 180);
    expect(deriveStatus(scheduled, at(5))).toBe("confirmed");
    expect(deriveStatus(scheduled, at(30))).toBe("preparing");
    expect(deriveStatus(scheduled, at(180))).toBe("completed");
  });
});

describe("timeline", () => {
  it("has five stages for delivery and four for pickup", () => {
    expect(timelineFor("delivery")).toHaveLength(5);
    expect(timelineFor("pickup")).toHaveLength(4);
    expect(timelineFor("pickup")).not.toContain("outForDelivery");
  });

  it("labels the final stage by how the order was fulfilled", () => {
    expect(statusLabel("completed", "delivery")).toBe("Delivered");
    expect(statusLabel("completed", "pickup")).toBe("Collected");
    expect(statusLabel("ready", "pickup")).toBe("Ready for pickup");
  });

  it("orders every stage", () => {
    const stages = timelineFor("delivery");
    const indexes = stages.map((s) => timelineIndex(s, "delivery"));
    expect(indexes).toEqual([0, 1, 2, 3, 4]);
  });

  it("puts every derived status somewhere on its own timeline", () => {
    for (const type of ["delivery", "pickup"] as const) {
      const order = base(type, 40);
      for (const minute of [0, 10, 26, 32, 41]) {
        const status = deriveStatus(order, at(minute));
        expect(timelineIndex(status, type), `${type} @${minute}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("order references", () => {
  it("has the shape customers can read out", () => {
    const reference = generateOrderReference();
    expect(reference).toMatch(/^UT-[A-Z0-9]{5}$/);
    expect(isValidReferenceShape(reference)).toBe(true);
  });

  it("omits the characters people mishear", () => {
    for (let i = 0; i < 400; i += 1) {
      expect(generateOrderReference()).not.toMatch(/[IO01]/);
    }
  });

  it("is unlikely to repeat", () => {
    const seen = new Set(Array.from({ length: 600 }, () => generateOrderReference()));
    expect(seen.size).toBeGreaterThan(590);
  });

  it("accepts what a customer might type", () => {
    expect(normalizeOrderReference("ut-4k7pq")).toBe("UT-4K7PQ");
    expect(normalizeOrderReference("  4K7PQ ")).toBe("UT-4K7PQ");
    expect(normalizeOrderReference("UT 4K7PQ")).toBe("UT-4K7PQ");
    expect(normalizeOrderReference("")).toBe("");
  });
});
