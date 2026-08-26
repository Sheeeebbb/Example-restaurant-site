import { describe, expect, it } from "vitest";
import {
  DELIVERY_FLOW,
  PICKUP_FLOW,
  advanceAction,
  canCancel,
  canTransition,
  isTerminalStatus,
  nextStatus,
  orderFlow,
} from "./transitions";
import { explainRefusal } from "./status";
import type { FulfillmentType, OrderStatus } from "../types";

/**
 * The lifecycle rules, checked exhaustively.
 *
 * Exhaustively on purpose: this is the file that decides whether an order can
 * be un-cancelled or a delivered order can be pulled back to the pass, and a
 * handful of examples would leave most of that surface untested. Every pair of
 * statuses is enumerated for both fulfilment types, and the ones that are
 * allowed are named one by one — so a new status, or an accidental extra edge,
 * fails a test rather than quietly widening what the kitchen can do.
 */
const ALL: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "outForDelivery",
  "completed",
  "cancelled",
];

const TYPES: FulfillmentType[] = ["delivery", "pickup"];

/**
 * Every move the system is meant to permit, per fulfilment type. Nothing
 * outside these lists is legal.
 */
const ALLOWED: Record<FulfillmentType, [OrderStatus, OrderStatus][]> = {
  delivery: [
    ["pending", "confirmed"],
    ["confirmed", "preparing"],
    ["preparing", "ready"],
    ["ready", "outForDelivery"],
    ["outForDelivery", "completed"],
    // Cancellation, available from anywhere unfinished.
    ["pending", "cancelled"],
    ["confirmed", "cancelled"],
    ["preparing", "cancelled"],
    ["ready", "cancelled"],
    ["outForDelivery", "cancelled"],
  ],
  pickup: [
    ["pending", "confirmed"],
    ["confirmed", "preparing"],
    ["preparing", "ready"],
    ["ready", "completed"],
    // Nothing puts a collection here, but an order from an older version of
    // this app could be, and it must still be finishable.
    ["outForDelivery", "completed"],
    ["pending", "cancelled"],
    ["confirmed", "cancelled"],
    ["preparing", "cancelled"],
    ["ready", "cancelled"],
    ["outForDelivery", "cancelled"],
  ],
};

const isAllowed = (from: OrderStatus, to: OrderStatus, type: FulfillmentType) =>
  ALLOWED[type].some(([a, b]) => a === from && b === to);

describe("the customer-facing progression", () => {
  it("is order received → preparing → ready → out for delivery → delivered", () => {
    expect(DELIVERY_FLOW).toEqual([
      "confirmed",
      "preparing",
      "ready",
      "outForDelivery",
      "completed",
    ]);
    expect(orderFlow("delivery")).toEqual(DELIVERY_FLOW);
  });

  it("leaves a collection on the shorter path, with no delivery stage", () => {
    expect(PICKUP_FLOW).toEqual(["confirmed", "preparing", "ready", "completed"]);
    expect(PICKUP_FLOW).not.toContain("outForDelivery");
  });

  it("steps a delivery through in that order, one at a time", () => {
    expect(nextStatus("confirmed", "delivery")).toBe("preparing");
    expect(nextStatus("preparing", "delivery")).toBe("ready");
    expect(nextStatus("ready", "delivery")).toBe("outForDelivery");
    expect(nextStatus("outForDelivery", "delivery")).toBe("completed");
    expect(nextStatus("completed", "delivery")).toBeNull();
  });

  it("walks each path end to end, one step per move", () => {
    for (const type of TYPES) {
      let status: OrderStatus = "confirmed";
      const walked: OrderStatus[] = [status];
      for (let step = 0; step < 10; step += 1) {
        const next = nextStatus(status, type);
        if (!next) break;
        status = next;
        walked.push(status);
      }
      expect(walked, type).toEqual([...orderFlow(type)]);
    }
  });
});

describe("canTransition — every pair, checked", () => {
  it("permits exactly the moves on the list and no others", () => {
    for (const type of TYPES) {
      for (const from of ALL) {
        for (const to of ALL) {
          expect(canTransition(from, to, type), `${type}: ${from} → ${to}`).toBe(
            isAllowed(from, to, type),
          );
        }
      }
    }
  });

  it("refuses every backwards move along the flow", () => {
    for (const type of TYPES) {
      const flow = orderFlow(type);
      for (let later = 1; later < flow.length; later += 1) {
        for (let earlier = 0; earlier < later; earlier += 1) {
          expect(
            canTransition(flow[later], flow[earlier], type),
            `${type}: ${flow[later]} → ${flow[earlier]}`,
          ).toBe(false);
        }
      }
    }
  });

  it("refuses skipping a stage", () => {
    expect(canTransition("confirmed", "ready", "delivery")).toBe(false);
    expect(canTransition("confirmed", "completed", "delivery")).toBe(false);
    expect(canTransition("preparing", "completed", "delivery")).toBe(false);
    // The one the new stage introduces: a delivery cannot arrive without
    // having left.
    expect(canTransition("ready", "completed", "delivery")).toBe(false);
  });

  it("refuses a status onto itself", () => {
    for (const type of TYPES) {
      for (const status of ALL) {
        expect(canTransition(status, status, type), `${type}: ${status}`).toBe(false);
      }
    }
  });

  it("will not send a collection out for delivery", () => {
    for (const from of ALL) {
      expect(canTransition(from, "outForDelivery", "pickup"), from).toBe(false);
    }
  });
});

describe("delivered is the end", () => {
  it("has nowhere left to go", () => {
    expect(nextStatus("completed", "delivery")).toBeNull();
    expect(isTerminalStatus("completed")).toBe(true);
    expect(advanceAction("completed", "delivery")).toBeNull();
    expect(advanceAction("completed", "pickup")).toBeNull();
  });

  it("cannot be moved back to any earlier stage", () => {
    for (const type of TYPES) {
      for (const to of ["ready", "preparing", "confirmed", "pending", "outForDelivery"] as const) {
        expect(canTransition("completed", to, type), `${type}: ${to}`).toBe(false);
      }
    }
  });

  it("cannot be cancelled after the fact", () => {
    expect(canCancel("completed")).toBe(false);
    expect(canTransition("completed", "cancelled", "delivery")).toBe(false);
  });
});

describe("cancelled is the end", () => {
  it("cannot resume into any status at all", () => {
    for (const type of TYPES) {
      for (const to of ALL) {
        expect(canTransition("cancelled", to, type), `${type}: cancelled → ${to}`).toBe(
          false,
        );
      }
    }
  });

  it("offers no progression action", () => {
    expect(nextStatus("cancelled", "delivery")).toBeNull();
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(advanceAction("cancelled", "delivery")).toBeNull();
  });

  it("cannot be cancelled twice", () => {
    expect(canCancel("cancelled")).toBe(false);
  });
});

describe("cancellation is a separate action, not a stage", () => {
  it("is not part of either progression", () => {
    for (const type of TYPES) {
      expect(orderFlow(type), type).not.toContain("cancelled");
      for (const status of ALL) {
        expect(nextStatus(status, type), `${type}: ${status}`).not.toBe("cancelled");
      }
    }
  });

  it("is available from every unfinished stage, on both paths", () => {
    for (const type of TYPES) {
      for (const status of ["pending", "confirmed", "preparing", "ready", "outForDelivery"] as const) {
        expect(canCancel(status), status).toBe(true);
        expect(canTransition(status, "cancelled", type), `${type}: ${status}`).toBe(true);
      }
    }
  });

  it("is not available once the order has finished", () => {
    expect(canCancel("completed")).toBe(false);
    expect(canCancel("cancelled")).toBe(false);
  });
});

describe("the one button staff are shown", () => {
  it("names the next step in the kitchen's own words", () => {
    expect(advanceAction("confirmed", "delivery")).toEqual({
      to: "preparing",
      label: "Start preparing",
    });
    expect(advanceAction("preparing", "delivery")).toEqual({
      to: "ready",
      label: "Mark ready",
    });
    expect(advanceAction("ready", "delivery")).toEqual({
      to: "outForDelivery",
      label: "Send out for delivery",
    });
    expect(advanceAction("outForDelivery", "delivery")).toEqual({
      to: "completed",
      label: "Mark delivered",
    });
  });

  it("says 'collected' on a pickup order, which is never delivered", () => {
    expect(advanceAction("ready", "pickup")).toEqual({
      to: "completed",
      label: "Mark collected",
    });
  });

  it("only ever offers a move the machine permits", () => {
    for (const status of ALL) {
      for (const type of TYPES) {
        const action = advanceAction(status, type);
        if (action) {
          expect(
            canTransition(status, action.to, type),
            `${type}: ${status} → ${action.to}`,
          ).toBe(true);
          expect(action.label.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never offers cancellation as the next step", () => {
    for (const type of TYPES) {
      for (const status of ALL) {
        expect(advanceAction(status, type)?.to, `${type}: ${status}`).not.toBe(
          "cancelled",
        );
      }
    }
  });
});

describe("refusals explain themselves", () => {
  it("says an order can't go backwards", () => {
    expect(explainRefusal("outForDelivery", "preparing", "delivery")).toMatch(
      /can't go back/i,
    );
    expect(explainRefusal("completed", "ready", "delivery")).toMatch(/already delivered/i);
  });

  it("says a cancelled order can't be reopened", () => {
    expect(explainRefusal("cancelled", "preparing", "delivery")).toMatch(
      /can't be reopened/i,
    );
  });

  it("says which step actually comes next when one is skipped", () => {
    expect(explainRefusal("confirmed", "completed", "delivery")).toMatch(/preparing/i);
    expect(explainRefusal("confirmed", "completed", "delivery")).toMatch(
      /one step at a time/i,
    );
    expect(explainRefusal("ready", "completed", "delivery")).toMatch(
      /out for delivery/i,
    );
  });

  it("says plainly that a collection is never out for delivery", () => {
    expect(explainRefusal("ready", "outForDelivery", "pickup")).toMatch(
      /isn't a stage of a collection order/i,
    );
  });

  it("never returns an empty message, whatever it is asked", () => {
    for (const type of TYPES) {
      for (const from of ALL) {
        for (const to of ALL) {
          const message = explainRefusal(from, to, type);
          expect(message.length, `${type}: ${from} → ${to}`).toBeGreaterThan(10);
        }
      }
    }
  });
});
