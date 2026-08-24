import type { FulfillmentType, OrderStatus } from "../types";

/**
 * The order lifecycle, as a state machine.
 *
 * This module is the single definition of what an order is allowed to do next.
 * The staff screen reads it to decide which button to draw, the repository
 * reads it to decide whether to write, and the API route reads it to decide
 * what to refuse. Hiding a button is a courtesy; `transitionOrder` in
 * `order-repository.ts` is the enforcement, and it asks this file.
 *
 *     Order received ──▶ Preparing ──▶ Ready ──▶ Delivered / Collected
 *           │               │            │
 *           └───────────────┴────────────┴──────▶ Cancelled
 *
 * Two properties the kitchen depends on:
 *
 *   • It only goes forward. There is no edge back to an earlier stage, so an
 *     order cannot be un-cooked by a mis-tap, and a customer watching the
 *     tracker never sees it retreat.
 *   • Both ends are terminal. `completed` and `cancelled` have no outgoing
 *     edges at all — not to each other, not to anything.
 *
 * Cancellation is deliberately NOT a step in the chain. It is a separate edge
 * available from any stage that hasn't finished, and it leads nowhere.
 */

/** The forward path every order follows, in order. */
export const ORDER_FLOW = [
  "confirmed",
  "preparing",
  "ready",
  "completed",
] as const satisfies readonly OrderStatus[];

/**
 * The one status each stage may advance to, or null where the order is done.
 *
 * `pending` is the pre-payment state; `placeOrder` never writes it, because an
 * order only exists once payment succeeds, but the type allows it and so the
 * machine answers for it rather than leaving a hole.
 *
 * `outForDelivery` is a retired stage. Delivery used to split the tail into
 * "ready" and "out for delivery", and orders placed before that changed may
 * still be sitting in it. It is not reachable any more, but it can still be
 * finished — stranding a live order in an unreachable state would be worse
 * than carrying one line of history.
 */
const NEXT: Record<OrderStatus, OrderStatus | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
  outForDelivery: "completed",
  completed: null,
  cancelled: null,
};

/** An order here is finished, one way or the other. Nothing moves it again. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return NEXT[status] === null;
}

/** The next stage, or null when the order has finished. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT[status];
}

/** Cancellation is possible right up until the order finishes, and not after. */
export function canCancel(status: OrderStatus): boolean {
  return !isTerminalStatus(status);
}

/**
 * The whole rule, in one predicate.
 *
 * Exactly two moves are legal from any stage: one step forward, or cancel.
 * Everything else — backwards, skipping ahead, a status onto itself, anything
 * out of a terminal state — is false.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "cancelled") return canCancel(from);
  return NEXT[from] === to;
}

/**
 * What the one progression button should say.
 *
 * Null when there is nothing left to do, which is how the staff screen knows to
 * draw no progression control at all rather than a disabled one.
 */
export function advanceAction(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): { to: OrderStatus; label: string } | null {
  const to = NEXT[status];
  if (!to) return null;

  const label =
    to === "confirmed"
      ? "Confirm order"
      : to === "preparing"
        ? "Start preparing"
        : to === "ready"
          ? "Mark ready"
          : fulfillmentType === "delivery"
            ? "Mark delivered"
            : "Mark collected";

  return { to, label };
}
