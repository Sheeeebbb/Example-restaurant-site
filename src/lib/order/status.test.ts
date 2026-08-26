import { describe, expect, it } from "vitest";
import {
  deriveStatus,
  statusDescription,
  statusLabel,
  timelineFor,
  timelineIndex,
} from "./status";
import { orderFlow } from "./transitions";
import {
  generateOrderReference,
  isValidReferenceShape,
  normalizeOrderReference,
} from "./reference";
import type { Order } from "../types";

const base = (
  type: "delivery" | "pickup",
  minutes: number,
): Pick<
  Order,
  "createdAt" | "estimatedReadyAt" | "fulfillment" | "status" | "history"
> => ({
  createdAt: new Date(2026, 7, 22, 18, 0).toISOString(),
  estimatedReadyAt: new Date(2026, 7, 22, 18, minutes).toISOString(),
  fulfillment: { type, timing: "asap" },
  status: "confirmed",
  history: [{ status: "confirmed", at: new Date(2026, 7, 22, 18, 0).toISOString(), by: "system" }],
});

const at = (minutes: number) => new Date(2026, 7, 22, 18, minutes);

describe("deriveStatus", () => {
  const delivery = base("delivery", 40);

  it("starts at 'received'", () => {
    expect(deriveStatus(delivery, at(0))).toBe("confirmed");
    expect(deriveStatus(delivery, at(2))).toBe("confirmed");
  });

  it("moves a delivery through preparing, ready, out for delivery, delivered", () => {
    expect(deriveStatus(delivery, at(10))).toBe("preparing");
    expect(deriveStatus(delivery, at(26))).toBe("ready");
    expect(deriveStatus(delivery, at(32))).toBe("outForDelivery");
    expect(deriveStatus(delivery, at(40))).toBe("completed");
    expect(deriveStatus(delivery, at(400))).toBe("completed");
  });

  it("never simulates 'out for delivery' on a collection", () => {
    const pickup = base("pickup", 40);
    const statuses = [0, 10, 26, 32, 39, 41].map((m) => deriveStatus(pickup, at(m)));
    expect(statuses).not.toContain("outForDelivery");
  });

  it("simulates delivery and pickup identically up to the point they differ", () => {
    for (const minute of [0, 10, 26]) {
      expect(deriveStatus(base("pickup", 40), at(minute)), `minute ${minute}`).toBe(
        deriveStatus(base("delivery", 40), at(minute)),
      );
    }
    // ...and then they part: the food is out on the road, or still on the pass.
    expect(deriveStatus(base("delivery", 40), at(32))).toBe("outForDelivery");
    expect(deriveStatus(base("pickup", 40), at(32))).toBe("ready");
  });

  it("never goes backwards as the clock advances", () => {
    let furthest = -1;
    for (let minute = 0; minute <= 60; minute += 1) {
      const index = timelineIndex(deriveStatus(delivery, at(minute)), "delivery");
      expect(index, `minute ${minute}`).toBeGreaterThanOrEqual(furthest);
      furthest = index;
    }
  });

  it("is stable — the same moment always gives the same status", () => {
    for (const minute of [0, 5, 15, 25, 35, 45]) {
      const first = deriveStatus(delivery, at(minute));
      expect(deriveStatus(delivery, at(minute))).toBe(first);
      expect(deriveStatus(delivery, at(minute))).toBe(first);
    }
  });

  it("stops simulating once staff have set a status", () => {
    // The clock says "preparing"; the kitchen says the food is ready. The
    // kitchen wins.
    const touched = {
      ...delivery,
      status: "ready" as const,
      history: [
        ...delivery.history,
        { status: "ready" as const, at: new Date(2026, 7, 22, 18, 5).toISOString(), by: "staff" as const },
      ],
    };
    expect(deriveStatus(touched, at(10))).toBe("ready");
    // ...and it does not drift back as time passes.
    expect(deriveStatus(touched, at(35))).toBe("ready");
  });

  it("still simulates an order staff have not touched", () => {
    expect(deriveStatus(delivery, at(10))).toBe("preparing");
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
    expect(deriveStatus(scheduled, at(140))).toBe("outForDelivery");
    expect(deriveStatus(scheduled, at(180))).toBe("completed");
  });
});

describe("timeline", () => {
  it("is the five stages a delivery customer is shown, in order", () => {
    expect(timelineFor("delivery")).toEqual([
      "confirmed",
      "preparing",
      "ready",
      "outForDelivery",
      "completed",
    ]);
  });

  it("is four stages for a collection, with no delivery among them", () => {
    expect(timelineFor("pickup")).toEqual([
      "confirmed",
      "preparing",
      "ready",
      "completed",
    ]);
  });

  it("reads the same journey the kitchen's buttons follow", () => {
    for (const type of ["delivery", "pickup"] as const) {
      expect(timelineFor(type), type).toEqual([...orderFlow(type)]);
    }
  });

  it("labels the last stages by how the order was fulfilled", () => {
    expect(statusLabel("confirmed", "delivery")).toBe("Order received");
    expect(statusLabel("preparing", "delivery")).toBe("Preparing");
    expect(statusLabel("ready", "delivery")).toBe("Ready");
    expect(statusLabel("ready", "pickup")).toBe("Ready for pickup");
    expect(statusLabel("outForDelivery", "delivery")).toBe("Out for delivery");
    expect(statusLabel("completed", "delivery")).toBe("Delivered");
    expect(statusLabel("completed", "pickup")).toBe("Collected");
  });

  it("describes each stage the way the restaurant means it", () => {
    expect(statusDescription("confirmed", "delivery")).toMatch(/kitchen has it/i);
    expect(statusDescription("preparing", "delivery")).toMatch(/cooked/i);
    expect(statusDescription("ready", "delivery")).toMatch(
      /ready to leave the restaurant/i,
    );
    expect(statusDescription("outForDelivery", "delivery")).toMatch(
      /left the restaurant/i,
    );
    expect(statusDescription("outForDelivery", "delivery")).toMatch(/on its way/i);
    expect(statusDescription("completed", "delivery")).toMatch(/delivered/i);
    expect(statusDescription("completed", "pickup")).toMatch(/collected/i);
  });

  it("orders every stage", () => {
    expect(
      timelineFor("delivery").map((s) => timelineIndex(s, "delivery")),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(timelineFor("pickup").map((s) => timelineIndex(s, "pickup"))).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("puts every derived status on the timeline", () => {
    for (const type of ["delivery", "pickup"] as const) {
      const order = base(type, 40);
      for (const minute of [0, 10, 26, 32, 41]) {
        const status = deriveStatus(order, at(minute));
        expect(timelineIndex(status, type), `${type} @${minute}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("puts cancelled nowhere on it — a cancelled order left the track", () => {
    // -1, so the tracker knows to draw the cancelled panel rather than light
    // up stage zero and tell the customer their order was just received.
    expect(timelineIndex("cancelled", "delivery")).toBe(-1);
    expect(timelineIndex("cancelled", "pickup")).toBe(-1);
  });

  it("puts 'out for delivery' nowhere on a collection's timeline", () => {
    expect(timelineIndex("outForDelivery", "pickup")).toBe(-1);
    expect(timelineIndex("outForDelivery", "delivery")).toBe(3);
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
