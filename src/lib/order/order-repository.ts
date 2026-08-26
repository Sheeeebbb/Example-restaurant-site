import type { Order, OrderStatus } from "../types";
import { getStore } from "../server/store";
import { canRevert, canTransition, nextStatus } from "./transitions";
import { explainRefusal, explainRevertRefusal, statusLabel } from "./status";
import { openRefund, settleRefund } from "./refund";

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
    /**
     * Staff's words. Required for a cancellation, optional on a correction,
     * ignored otherwise.
     */
    reason?: string;
    /**
     * Treat this as a deliberate correction rather than an ordinary step.
     *
     * Set ONLY by `revertOrder`, which the API reaches only from an explicit
     * revert action. Without it a backwards target is refused, which is what
     * keeps an accidental reversal impossible rather than merely unlikely: no
     * ordinary request — a stale button, an old client, a hand-rolled `curl`
     * naming a status — can produce one, because none of them can set this.
     */
    backwards?: boolean;
    /**
     * The status the caller believed the order was in.
     *
     * The kitchen board polls, so a button can be a few seconds out of date. If
     * someone else moved the order in the meantime, this refuses rather than
     * applying an instruction that was about a different situation — a second
     * tap on "Mark ready" must not quietly deliver the order.
     */
    expectedFrom?: OrderStatus;
    /**
     * Who is doing this, for the audit trail.
     *
     * Not an authorisation input — nothing here consults it to decide whether
     * the move is allowed. Permission was settled before this was called, by
     * `authorizeStatusChange` against permissions resolved from the session.
     * This records it.
     */
    actor?: { id: string; name: string };
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

  /*
   * The two allowed shapes of move, and nothing else.
   *
   * A correction is checked against `canRevert`; everything else against
   * `canTransition`, which still refuses every backwards target. A caller that
   * wants to go back has to have said so, in a separate call, having named
   * where it believed the order was.
   */
  const permitted = options.backwards
    ? canRevert(from, to, fulfillmentType)
    : canTransition(from, to, fulfillmentType);

  if (!permitted) {
    return {
      ok: false,
      reason: from === to ? "conflict" : "invalid",
      error: options.backwards
        ? explainRevertRefusal(from, to, fulfillmentType)
        : explainRefusal(from, to, fulfillmentType),
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
  const cancelling = to === "cancelled";

  const updated: Order = {
    ...existing,
    status: to,
    history: [
      ...existing.history,
      {
        status: to,
        at,
        note: cancelling || options.backwards ? reason : undefined,
        // Only a correction records where it came from — see `OrderStatusEvent`.
        ...(options.backwards ? { from } : {}),
        ...(options.actor
          ? { actorId: options.actor.id, actorName: options.actor.name }
          : {}),
        by: "staff",
      },
    ],
    // Recorded on the order itself as well as in the history, so the customer's
    // tracker and the staff screen read one field rather than each re-deriving
    // the same answer by walking the trail.
    ...(cancelling ? { cancellationReason: reason, cancelledAt: at } : {}),
  };

  if (!cancelling) {
    store.orders.set(reference, updated);
    return { ok: true, order: clone(updated) };
  }

  /*
   * A cancellation is also a refund, and the two are committed in that order.
   *
   * The cancellation is written first, on its own, with the refund marked as
   * asked-for and unconfirmed. Only then is the provider called. That ordering
   * is deliberate: the customer's order is cancelled the moment staff say so,
   * and a payment provider having a bad afternoon cannot undo that, leave the
   * kitchen cooking food nobody is coming for, or make the staff member press
   * the button again.
   *
   * What it costs is that the order is briefly readable in a state where the
   * refund is pending — which is not a flaw, it is the honest description of
   * that moment, and it is exactly what the order is left showing if the
   * process dies mid-call.
   */
  const opened = openRefund(updated, at);
  store.orders.set(reference, { ...updated, refund: opened });

  const settled = await settleRefund(updated, opened);

  // Re-read rather than writing `updated` back: minutes of wall-clock may have
  // passed inside the provider call, and whatever else has happened to this
  // order in the meantime is not ours to discard. Only the refund is.
  const current = store.orders.get(reference) ?? updated;
  const finished: Order = { ...current, refund: settled };
  store.orders.set(reference, finished);

  return { ok: true, order: clone(finished) };
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
  actor?: { id: string; name: string },
): Promise<OrderTransitionResult> {
  const existing = getStore().orders.get(reference);
  if (!existing) {
    return { ok: false, reason: "not-found", error: "No such order." };
  }

  const to = nextStatus(existing.status, existing.fulfillment.type);
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

  return transitionOrder(reference, to, { expectedFrom, actor });
}

/**
 * Moves an order BACK to an earlier stage, because someone got it wrong.
 *
 * The only route to a backwards move in the application. It is a separate
 * function rather than an option on `advanceOrder` for the same reason
 * cancelling is: the interface that offers it, the confirmation it demands and
 * the trail it leaves are all different, and a caller has to choose it
 * deliberately.
 *
 * `expectedFrom` is REQUIRED here, unlike everywhere else. A correction is
 * always about a specific wrong reading — "this says ready and it isn't" — so a
 * request that cannot say what it is correcting is not a correction, it is a
 * guess, and the kitchen board is up to fifteen seconds stale at any moment.
 */
export async function revertOrder(
  reference: string,
  to: OrderStatus,
  expectedFrom: OrderStatus,
  reason?: string,
  actor?: { id: string; name: string },
): Promise<OrderTransitionResult> {
  return transitionOrder(reference, to, {
    reason,
    expectedFrom,
    backwards: true,
    actor,
  });
}

/**
 * Ends an order, with the reason the customer will be shown, and starts the
 * refund. There is no way to cancel without the refund being attempted — that
 * is the whole reason this and `transitionOrder` are one code path.
 */
export async function cancelOrder(
  reference: string,
  reason: string,
  expectedFrom?: OrderStatus,
  actor?: { id: string; name: string },
): Promise<OrderTransitionResult> {
  return transitionOrder(reference, "cancelled", { reason, expectedFrom, actor });
}

/* ── Delivery assignment ────────────────────────────────────────────────────*/

/**
 * A driver claims an order.
 *
 * The one operation in this application where two people can genuinely race:
 * two drivers looking at the same "available" list, both pressing Accept.
 * Exactly one must win, and the loser must be told the truth rather than shown
 * a delivery they do not have.
 *
 * ── How the race is closed ─────────────────────────────────────────────────
 * The read of `assignedStaffId` and the write that sets it happen in one
 * synchronous block with no `await` between them. Node runs one request's
 * synchronous code to completion before starting another's, so no second
 * claim can observe the order as unassigned after the first has taken it. That
 * is a real guarantee here, not an optimistic hope — but it is a guarantee of
 * THIS store, and it is why the check-and-set is written as one statement
 * rather than spread across helpers with awaits in between.
 *
 * Against a database the same shape becomes a conditional write —
 * `UPDATE orders SET assigned_staff_id = $1 WHERE reference = $2 AND
 * assigned_staff_id IS NULL` — and the loser is the one whose UPDATE reports
 * zero rows. The important property in both is identical: whoever loses finds
 * out from the write, never from a read taken beforehand.
 */
export type ClaimResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not-found" | "taken" | "not-deliverable"; error: string };

export async function claimDelivery(
  reference: string,
  staffId: string,
): Promise<ClaimResult> {
  const store = getStore();

  // ── begin critical section: no `await` until the write is done ──
  const existing = store.orders.get(reference);
  if (!existing) {
    return { ok: false, reason: "not-found", error: "No such order." };
  }
  if (existing.fulfillment.type !== "delivery") {
    return {
      ok: false,
      reason: "not-deliverable",
      error: "That order is being collected from the counter, not delivered.",
    };
  }
  if (existing.status === "cancelled" || existing.status === "completed") {
    return {
      ok: false,
      reason: "not-deliverable",
      error: "That order is finished. There is nothing to deliver.",
    };
  }
  if (existing.assignedStaffId && existing.assignedStaffId !== staffId) {
    return {
      ok: false,
      reason: "taken",
      error: "Another driver got there first — this delivery is already assigned.",
    };
  }
  if (existing.assignedStaffId === staffId) {
    // Idempotent: a double tap is the same claim, not an error.
    return { ok: true, order: clone(existing) };
  }

  const claimed: Order = {
    ...existing,
    assignedStaffId: staffId,
    assignedAt: new Date().toISOString(),
  };
  store.orders.set(reference, claimed);
  // ── end critical section ──

  return { ok: true, order: clone(claimed) };
}

/** Hands a delivery back to the pool. Only ever the driver's own, or a manager's doing. */
export async function releaseDelivery(reference: string): Promise<ClaimResult> {
  const store = getStore();
  const existing = store.orders.get(reference);
  if (!existing) return { ok: false, reason: "not-found", error: "No such order." };

  const released: Order = { ...existing };
  delete released.assignedStaffId;
  delete released.assignedAt;
  store.orders.set(reference, released);
  return { ok: true, order: clone(released) };
}

/**
 * Asks the provider again for a refund that did not go through.
 *
 * Only for a cancelled order whose refund actually failed. A refund that
 * succeeded is not retried — sending the money twice is worse than the problem
 * — and an order that was never cancelled has nothing owed, so neither can be
 * reached through here however the request is shaped.
 *
 * The retry keeps the original `initiatedAt`: the customer asked for their
 * money back when the order was cancelled, not when someone got round to
 * chasing it.
 */
export async function retryRefund(
  reference: string,
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const store = getStore();
  const existing = store.orders.get(reference);
  if (!existing) return { ok: false, error: "No such order." };

  if (existing.status !== "cancelled") {
    return {
      ok: false,
      error: "Only a cancelled order has a refund to retry. Cancel it if that is what you meant.",
    };
  }

  const refund = existing.refund;
  if (!refund || refund.status === "notRequired") {
    return { ok: false, error: "No payment was captured for this order, so there is nothing to send back." };
  }
  if (refund.status === "succeeded") {
    return { ok: false, error: "That refund already went through. Retrying it would pay the customer twice." };
  }

  const settled = await settleRefund(existing, { ...refund, status: "pending" });

  const current = store.orders.get(reference) ?? existing;
  const updated: Order = { ...current, refund: settled };
  store.orders.set(reference, updated);
  return { ok: true, order: clone(updated) };
}
