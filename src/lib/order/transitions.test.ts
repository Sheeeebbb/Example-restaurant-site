import { describe, expect, it } from "vitest";
import {
  DELIVERY_FLOW,
  PICKUP_FLOW,
  advanceAction,
  canCancel,
  canRevert,
  canTransition,
  isBackwards,
  isTerminalStatus,
  nextStatus,
  orderFlow,
  revertTargets,
} from "./transitions";
import { explainRefusal, explainRevertRefusal, revertWarning } from "./status";
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
  it("points a backwards attempt at the action that can do it", () => {
    // Not "you can't" — you can, but not through the ordinary step.
    const message = explainRefusal("outForDelivery", "preparing", "delivery");
    expect(message).toMatch(/correction, not a step/i);
    expect(message).toMatch(/confirm/i);
  });

  it("says a finished order is finished before it says anything else", () => {
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

/**
 * Going backwards.
 *
 * The rules under test are not "a reversal is allowed" but the two that make it
 * safe: it is a DIFFERENT edge from the ordinary progression, so nothing that
 * asks for an ordinary move can produce one by accident; and it is refused out
 * of a cancellation, which is an ending rather than a stage that overshot.
 */
describe("moving an order backwards", () => {
  it("is offered from every stage that has something behind it", () => {
    expect(revertTargets("preparing", "delivery")).toEqual(["confirmed"]);
    expect(revertTargets("ready", "delivery")).toEqual(["confirmed", "preparing"]);
    expect(revertTargets("outForDelivery", "delivery")).toEqual([
      "confirmed",
      "preparing",
      "ready",
    ]);
    expect(revertTargets("completed", "delivery")).toEqual([
      "confirmed",
      "preparing",
      "ready",
      "outForDelivery",
    ]);
  });

  it("offers nothing at the first stage — there is nowhere behind it", () => {
    expect(revertTargets("confirmed", "delivery")).toEqual([]);
  });

  it("covers the four corrections staff actually make", () => {
    const cases: [OrderStatus, OrderStatus][] = [
      ["preparing", "confirmed"],
      ["ready", "preparing"],
      ["outForDelivery", "ready"],
      ["completed", "outForDelivery"],
    ];
    for (const [from, to] of cases) {
      expect(canRevert(from, to, "delivery"), `${from} -> ${to}`).toBe(true);
      expect(isBackwards(from, to, "delivery"), `${from} -> ${to}`).toBe(true);
    }
  });

  it("leaves a collection its own shorter set", () => {
    expect(revertTargets("completed", "pickup")).toEqual([
      "confirmed",
      "preparing",
      "ready",
    ]);
    // Never a stage that isn't on this order's path, in either direction.
    expect(canRevert("completed", "outForDelivery", "pickup")).toBe(false);
  });

  it("is never the same edge as an ordinary move", () => {
    // The property the whole design rests on: no pair is both. A request that
    // asks for an ordinary transition therefore cannot reverse an order,
    // whatever status it names.
    for (const type of TYPES) {
      for (const from of ALL) {
        for (const to of ALL) {
          const ordinary = canTransition(from, to, type);
          const correction = canRevert(from, to, type);
          expect(ordinary && correction, `${type}: ${from} -> ${to}`).toBe(false);
        }
      }
    }
  });

  it("never goes forwards, sideways, or nowhere", () => {
    for (const type of TYPES) {
      for (const from of ALL) {
        for (const to of ALL) {
          if (!canRevert(from, to, type)) continue;
          const flow = orderFlow(type);
          expect(flow.indexOf(to), `${type}: ${from} -> ${to}`).toBeLessThan(
            flow.indexOf(from),
          );
        }
      }
    }
  });

  it("cannot reinstate a cancelled order", () => {
    for (const type of TYPES) {
      expect(revertTargets("cancelled", type), type).toEqual([]);
      for (const to of ALL) {
        expect(canRevert("cancelled", to, type), `${type}: cancelled -> ${to}`).toBe(
          false,
        );
      }
    }
  });

  it("cannot be used to cancel", () => {
    for (const type of TYPES) {
      for (const from of ALL) {
        expect(canRevert(from, "cancelled", type), `${type}: ${from}`).toBe(false);
      }
    }
  });

  it("refuses to correct an order onto the status it is already in", () => {
    for (const type of TYPES) {
      for (const status of ALL) {
        expect(canRevert(status, status, type), `${type}: ${status}`).toBe(false);
      }
    }
  });
});

describe("the confirmation staff are shown before going back", () => {
  it("names both ends of the move", () => {
    const warning = revertWarning("ready", "preparing", "delivery");
    expect(warning.title).toBe("Move order backwards?");
    expect(warning.detail).toBe(
      'You are changing this order from "Ready" back to "Preparing".',
    );
    expect(warning.consequence).toMatch(/tracking and staff workflow/i);
  });

  it("says plainly that a delivered order is already delivered", () => {
    const warning = revertWarning("completed", "outForDelivery", "delivery");
    expect(warning.title).toMatch(/already marked delivered/i);
    expect(warning.consequence).toMatch(/the customer has been told/i);
    // ...and it does not read like the ordinary one.
    expect(warning.consequence).not.toBe(
      revertWarning("ready", "preparing", "delivery").consequence,
    );
  });

  it("uses the collection's words on a collection", () => {
    expect(revertWarning("completed", "ready", "pickup").title).toMatch(
      /already marked collected/i,
    );
    expect(revertWarning("ready", "preparing", "pickup").detail).toContain(
      "Ready for pickup",
    );
  });

  it("always gives a staff member all three sentences", () => {
    for (const type of TYPES) {
      for (const from of ALL) {
        for (const to of revertTargets(from, type)) {
          const warning = revertWarning(from, to, type);
          for (const part of [warning.title, warning.detail, warning.consequence]) {
            expect(part.length, `${type}: ${from} -> ${to}`).toBeGreaterThan(10);
          }
        }
      }
    }
  });
});

describe("refused corrections explain themselves", () => {
  it("says a cancellation cannot be corrected away", () => {
    const message = explainRevertRefusal("cancelled", "ready", "delivery");
    expect(message).toMatch(/cancelled and refunded/i);
    expect(message).toMatch(/new order/i);
  });

  it("sends someone reaching for cancel to the cancel action", () => {
    expect(explainRevertRefusal("ready", "cancelled", "delivery")).toMatch(
      /use the cancel action/i,
    );
  });

  it("says which direction a forwards target is in", () => {
    expect(explainRevertRefusal("preparing", "completed", "delivery")).toMatch(
      /not behind preparing/i,
    );
  });

  it("never returns an empty message, whatever it is asked", () => {
    for (const type of TYPES) {
      for (const from of ALL) {
        for (const to of ALL) {
          const message = explainRevertRefusal(from, to, type);
          expect(message.length, `${type}: ${from} -> ${to}`).toBeGreaterThan(10);
        }
      }
    }
  });
});
