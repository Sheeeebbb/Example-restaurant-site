import type { Order, OrderStatus } from "../types";
import { getStore } from "../server/store";
import { canTransition, nextStatus } from "./transitions";
import { explainRefusal, statusLabel } from "./status";

/**
 * Order persistence.
 *
 * SERVER ONLY, and async throughout even though it currently resolves from a
 * Map — the same rule the menu repository follows. Swapping in a database
 * changes these function bodies and nothing that calls them.
 *
 * This is what lets the customer's order and the kitchen's order be the same
 * order. Before it existed, orders lived only in the customer's browser tab,
 * so staff could never have seen one.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function saveOrder(order: Order): Promise<Order> {
  getStore().orders.set(order.reference, clone(order));
  return clone(order);
}

export async function getOrder(reference: string): Promise<Order | null> {
  const found = getStore().orders.get(reference);
  return found ? clone(found) : null;
}

/** Newest first — the order a kitchen wants to see a queue in. */
export async function listOrders(): Promise<Order[]> {
  return clone(
    [...getStore().orders.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
}

/**
 * The only way an order's status ever changes.
 *
 * Every caller — the staff screen, the API route, anything added later — comes
 * through here, and here the state machine gets the final say. A request to
 * move an order backwards, to skip a stage, or to touch one that has already
 * finished is refused at this line, not merely left undrawn in the interface.
 * That is what makes the rule real rather than cosmetic: an invalid transition
 * fails the same way whether it arrives from the button, from `curl`, or from
 * a screen that was rendered before someone else moved the order on.
 *
 * The `by: "staff"` marker on the history entry matters beyond the audit trail:
 * it tells the customer-facing tracker to stop simulating progress from the
 * clock and show what the kitchen actually said. See `lib/order/status.ts`.
 */
export type OrderTransitionResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      /** `conflict` is a legal-but-not-now move; `invalid` never becomes legal. */
      reason: "not-found" | "conflict" | "invalid";
      error: string;
      /** The order as it actually stands, so a stale screen can correct itself. */
      order?: Order;
    };

export async function transitionOrder(
  reference: string,
  to: OrderStatus,
  options: {
    /** Staff's words. Required for a cancellation, ignored otherwise. */
    reason?: string;
    /**
     * The status the caller believed the order was in.
     *
     * The kitchen board polls, so a button can be a few seconds out of date. If
     * someone else moved the order in the meantime, this refuses rather than
     * applying an instruction that was about a different situation — a second
     * tap on "Mark ready" must not quietly deliver the order.
     */
    expectedFrom?: OrderStatus;
  } = {},
): Promise<OrderTransitionResult> {
  const store = getStore();
  const existing = store.orders.get(reference);
  if (!existing) {
    return { ok: false, reason: "not-found", error: "No such order." };
  }

  const from = existing.status;
  const fulfillmentType = existing.fulfillment.type;

  if (options.expectedFrom && options.expectedFrom !== from) {
    return {
      ok: false,
      reason: "conflict",
      error: `Someone else moved this order while you were looking at it — it is now "${statusLabel(
        from,
        fulfillmentType,
      )}".`,
      order: clone(existing),
    };
  }

  if (!canTransition(from, to)) {
    return {
      ok: false,
      reason: from === to ? "conflict" : "invalid",
      error: explainRefusal(from, to, fulfillmentType),
      order: clone(existing),
    };
  }

  const reason = options.reason?.trim();
  if (to === "cancelled" && !reason) {
    return {
      ok: false,
      reason: "invalid",
      error: "Give a reason for the cancellation — the customer is shown it.",
      order: clone(existing),
    };
  }

  const at = new Date().toISOString();
  const updated: Order = {
    ...existing,
    status: to,
    history: [
      ...existing.history,
      { status: to, at, note: to === "cancelled" ? reason : undefined, by: "staff" },
    ],
    // Recorded on the order itself as well as in the history, so the customer's
    // tracker and the staff screen read one field rather than each re-deriving
    // the same answer by walking the trail.
    ...(to === "cancelled" ? { cancellationReason: reason, cancelledAt: at } : {}),
  };

  store.orders.set(reference, updated);
  return { ok: true, order: clone(updated) };
}

/**
 * Moves an order one step along its own path.
 *
 * The destination is never passed in — it is whatever the machine says comes
 * next — so there is no way to ask for a jump, only for the next step.
 */
export async function advanceOrder(
  reference: string,
  expectedFrom?: OrderStatus,
): Promise<OrderTransitionResult> {
  const existing = getStore().orders.get(reference);
  if (!existing) {
    return { ok: false, reason: "not-found", error: "No such order." };
  }

  const to = nextStatus(existing.status);
  if (!to) {
    return {
      ok: false,
      reason: "conflict",
      error:
        existing.status === "cancelled"
          ? "This order was cancelled, and a cancelled order can't be reopened."
          : "This order is complete. There is nothing further to do.",
      order: clone(existing),
    };
  }

  return transitionOrder(reference, to, { expectedFrom });
}

/** Ends an order, with the reason the customer will be shown. */
export async function cancelOrder(
  reference: string,
  reason: string,
  expectedFrom?: OrderStatus,
): Promise<OrderTransitionResult> {
  return transitionOrder(reference, "cancelled", { reason, expectedFrom });
}
