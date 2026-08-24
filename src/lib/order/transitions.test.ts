import { describe, expect, it } from "vitest";
import {
  ORDER_FLOW,
  advanceAction,
  canCancel,
  canTransition,
  isTerminalStatus,
  nextStatus,
} from "./transitions";
import { explainRefusal } from "./status";
import type { OrderStatus } from "../types";

/**
 * The lifecycle rules, checked exhaustively.
 *
 * Exhaustively on purpose: this is the file that decides whether an order can
 * be un-cancelled or a delivered order can be pulled back to the pass, and a
 * handful of examples would leave most of that surface untested. Every pair of
 * statuses is enumerated, and the ones that are allowed are named one by one —
 * so a new status, or an accidental extra edge, fails a test rather than
 * quietly widening what the kitchen can do.
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

/** Every move the system is meant to permit. Nothing outside this list is legal. */
const ALLOWED: [OrderStatus, OrderStatus][] = [
  ["pending", "confirmed"],
  ["confirmed", "preparing"],
  ["preparing", "ready"],
  ["ready", "completed"],
  // A retired stage that live orders may still be sitting in.
  ["outForDelivery", "completed"],
  // Cancellation, available from anywhere unfinished.
  ["pending", "cancelled"],
  ["confirmed", "cancelled"],
  ["preparing", "cancelled"],
  ["ready", "cancelled"],
  ["outForDelivery", "cancelled"],
];

const isAllowed = (from: OrderStatus, to: OrderStatus) =>
  ALLOWED.some(([a, b]) => a === from && b === to);

describe("the customer-facing progression", () => {
  it("is order received → preparing → ready → delivered", () => {
    expect(ORDER_FLOW).toEqual(["confirmed", "preparing", "ready", "completed"]);
  });

  it("steps through in that order, one at a time", () => {
    expect(nextStatus("confirmed")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("ready");
    expect(nextStatus("ready")).toBe("completed");
    expect(nextStatus("completed")).toBeNull();
  });

  it("walks the whole path in exactly three moves", () => {
    let status: OrderStatus = "confirmed";
    const walked: OrderStatus[] = [status];
    for (let step = 0; step < 10; step += 1) {
      const next = nextStatus(status);
      if (!next) break;
      status = next;
      walked.push(status);
    }
    expect(walked).toEqual(["confirmed", "preparing", "ready", "completed"]);
  });
});

describe("canTransition — every pair, checked", () => {
  it("permits exactly the moves on the list and no others", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(isAllowed(from, to));
      }
    }
  });

  it("refuses every backwards move along the flow", () => {
    for (let later = 1; later < ORDER_FLOW.length; later += 1) {
      for (let earlier = 0; earlier < later; earlier += 1) {
        const from = ORDER_FLOW[later];
        const to = ORDER_FLOW[earlier];
        expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it("refuses skipping a stage", () => {
    expect(canTransition("confirmed", "ready")).toBe(false);
    expect(canTransition("confirmed", "completed")).toBe(false);
    expect(canTransition("preparing", "completed")).toBe(false);
  });

  it("refuses a status onto itself", () => {
    for (const status of ALL) {
      expect(canTransition(status, status), status).toBe(false);
    }
  });
});

describe("delivered is the end", () => {
  it("has nowhere left to go", () => {
    expect(nextStatus("completed")).toBeNull();
    expect(isTerminalStatus("completed")).toBe(true);
    expect(advanceAction("completed", "delivery")).toBeNull();
    expect(advanceAction("completed", "pickup")).toBeNull();
  });

  it("cannot be moved back to any earlier stage", () => {
    for (const to of ["ready", "preparing", "confirmed", "pending", "outForDelivery"] as const) {
      expect(canTransition("completed", to), to).toBe(false);
    }
  });

  it("cannot be cancelled after the fact", () => {
    expect(canCancel("completed")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });
});

describe("cancelled is the end", () => {
  it("cannot resume into any status at all", () => {
    for (const to of ALL) {
      expect(canTransition("cancelled", to), `cancelled → ${to}`).toBe(false);
    }
  });

  it("offers no progression action", () => {
    expect(nextStatus("cancelled")).toBeNull();
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(advanceAction("cancelled", "delivery")).toBeNull();
  });

  it("cannot be cancelled twice", () => {
    expect(canCancel("cancelled")).toBe(false);
  });
});

describe("cancellation is a separate action, not a stage", () => {
  it("is not part of the progression", () => {
    expect(ORDER_FLOW).not.toContain("cancelled");
    for (const status of ALL) {
      expect(nextStatus(status), status).not.toBe("cancelled");
    }
  });

  it("is available from every unfinished stage", () => {
    for (const status of ["pending", "confirmed", "preparing", "ready", "outForDelivery"] as const) {
      expect(canCancel(status), status).toBe(true);
      expect(canTransition(status, "cancelled"), status).toBe(true);
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
      to: "completed",
      label: "Mark delivered",
    });
  });

  it("says 'collected' on a pickup order, which is never delivered", () => {
    expect(advanceAction("ready", "pickup")?.label).toBe("Mark collected");
  });

  it("only ever offers a move the machine permits", () => {
    for (const status of ALL) {
      for (const type of ["delivery", "pickup"] as const) {
        const action = advanceAction(status, type);
        if (action) {
          expect(canTransition(status, action.to), `${status} → ${action.to}`).toBe(true);
          expect(action.label.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never offers cancellation as the next step", () => {
    for (const status of ALL) {
      expect(advanceAction(status, "delivery")?.to).not.toBe("cancelled");
    }
  });
});

describe("refusals explain themselves", () => {
  it("says an order can't go backwards", () => {
    expect(explainRefusal("ready", "preparing", "delivery")).toMatch(/can't go back/i);
    expect(explainRefusal("completed", "ready", "delivery")).toMatch(/already delivered/i);
  });

  it("says a cancelled order can't be reopened", () => {
    expect(explainRefusal("cancelled", "preparing", "delivery")).toMatch(/can't be reopened/i);
  });

  it("says which step actually comes next when one is skipped", () => {
    expect(explainRefusal("confirmed", "completed", "delivery")).toMatch(/preparing/i);
    expect(explainRefusal("confirmed", "completed", "delivery")).toMatch(/one step at a time/i);
  });

  it("never returns an empty message, whatever it is asked", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const message = explainRefusal(from, to, "delivery");
        expect(message.length, `${from} → ${to}`).toBeGreaterThan(10);
      }
    }
  });
});
