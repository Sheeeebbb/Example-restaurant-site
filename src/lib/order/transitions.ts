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
 *   delivery
 *     Order received ──▶ Preparing ──▶ Ready ──▶ Out for delivery ──▶ Delivered
 *
 *   pickup
 *     Order received ──▶ Preparing ──▶ Ready ──▶ Collected
 *
 *   both
 *     any unfinished stage ──▶ Cancelled
 *
 * Delivery and pickup are the same journey until the food is ready, and then
 * they are not: a delivery order leaves the building and travels, a pickup
 * order waits on the counter. "Out for delivery" is a real stage of the first
 * and a meaningless one for the second, so the path is chosen by fulfilment
 * type rather than shared and then fudged in the wording.
 *
 * Three properties the kitchen depends on:
 *
 *   • It only goes forward. There is no edge back to an earlier stage, so an
 *     order cannot be un-cooked by a mis-tap, and a customer watching the
 *     tracker never sees it retreat.
 *   • It goes one step at a time. Nothing may skip a stage — an order cannot be
 *     delivered without having left, whoever asks and however they ask.
 *   • Both ends are terminal. `completed` and `cancelled` have no outgoing
 *     edges at all — not to each other, not to anything.
 *
 * Cancellation is deliberately NOT a step in the chain. It is a separate edge
 * available from any stage that hasn't finished, and it leads nowhere.
 *
 * ── Going backwards ─────────────────────────────────────────────────────────
 *
 * Staff mis-tap, and an order stuck a stage ahead of the food is worse than one
 * that can be corrected. So a stage can be walked back — but it is a SEPARATE
 * edge from the ordinary progression, exactly as cancellation is, and the two
 * predicates are kept apart on purpose:
 *
 *   canTransition   the ordinary moves. One step forward, or cancel. This is
 *                   what the quick button asks, and it still refuses every
 *                   backwards move.
 *   canRevert       the correction. Any EARLIER stage on this order's own path.
 *
 * Nothing routes a backwards move through `canTransition`, which is what stops
 * a mis-typed request, an old client, or a stale screen from walking an order
 * back by accident: reversing requires asking for it by name, through
 * `revertOrder`, which the API reaches only from an explicit revert action.
 * The confirmation dialog is the courtesy on top of that, not the mechanism.
 */

/** The forward path a delivery order follows, in order. */
export const DELIVERY_FLOW = [
  "confirmed",
  "preparing",
  "ready",
  "outForDelivery",
  "completed",
] as const satisfies readonly OrderStatus[];

/** The forward path a pickup order follows. No travel, so no travelling stage. */
export const PICKUP_FLOW = [
  "confirmed",
  "preparing",
  "ready",
  "completed",
] as const satisfies readonly OrderStatus[];

/** The stages this order will pass through, in order. */
export function orderFlow(
  fulfillmentType: FulfillmentType,
): readonly OrderStatus[] {
  return fulfillmentType === "delivery" ? DELIVERY_FLOW : PICKUP_FLOW;
}

/**
 * The one status each stage may advance to, or null where the order is done.
 *
 * `pending` is the pre-payment state; `placeOrder` never writes it, because an
 * order only exists once payment succeeds, but the type allows it and so the
 * machine answers for it rather than leaving a hole.
 *
 * `outForDelivery` appears in the pickup table too, mapped straight to done.
 * A pickup order should never be in it — nothing can put it there — but an
 * order from an earlier version of this app might be, and stranding a live
 * order in a state with no way out would be worse than one line of table.
 */
const NEXT: Record<FulfillmentType, Record<OrderStatus, OrderStatus | null>> = {
  delivery: {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "outForDelivery",
    outForDelivery: "completed",
    completed: null,
    cancelled: null,
  },
  pickup: {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "completed",
    outForDelivery: "completed",
    completed: null,
    cancelled: null,
  },
};

/**
 * An order here is finished, one way or the other. Nothing moves it again.
 *
 * Independent of fulfilment type, and checked against both tables so it stays
 * that way: a stage that is the end of one journey and the middle of the other
 * would be a bug, not a state worth modelling.
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return NEXT.delivery[status] === null && NEXT.pickup[status] === null;
}

/** The next stage on this order's path, or null when it has finished. */
export function nextStatus(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): OrderStatus | null {
  return NEXT[fulfillmentType][status];
}

/** Cancellation is possible right up until the order finishes, and not after. */
export function canCancel(status: OrderStatus): boolean {
  return !isTerminalStatus(status);
}

/**
 * The ordinary moves, in one predicate.
 *
 * Exactly two are legal from any stage: one step forward along this order's own
 * path, or cancel. Everything else — backwards, skipping ahead, a status onto
 * itself, anything out of a terminal state, and "out for delivery" on an order
 * nobody is delivering — is false here.
 *
 * Backwards is false on purpose even though staff may now go back. Correcting a
 * status is a different act with a different affordance and a different API
 * verb, and `canRevert` is the predicate that answers for it. Keeping the two
 * apart is what makes an accidental reversal impossible rather than merely
 * unlikely: no amount of getting the ordinary request wrong can produce one.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): boolean {
  if (to === "cancelled") return canCancel(from);
  return NEXT[fulfillmentType][from] === to;
}

/**
 * Is `to` earlier than `from` on this order's own path?
 *
 * False when either status is not a stage of that path at all — `cancelled` is
 * not behind anything, and neither is "out for delivery" on a collection. Those
 * are not backwards moves, they are moves off the path, and they stay refused.
 */
export function isBackwards(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): boolean {
  const flow = orderFlow(fulfillmentType);
  const fromStage = flow.indexOf(from);
  const toStage = flow.indexOf(to);
  return fromStage !== -1 && toStage !== -1 && toStage < fromStage;
}

/**
 * May this order be corrected back to `to`?
 *
 * Any earlier stage qualifies, not merely the one immediately behind: two quick
 * taps put an order two stages ahead of the food, and making staff confirm
 * their way back one screen at a time would teach them to click through
 * confirmations, which is the opposite of what a confirmation is for.
 *
 * A cancelled order is the exception and stays one: it is not a stage that ran
 * ahead of itself, it is an order that ended, the customer has been told so,
 * and a refund has been raised against it. Reinstating that is not a status
 * correction — it is a new order.
 */
export function canRevert(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): boolean {
  if (from === "cancelled" || to === "cancelled") return false;
  return isBackwards(from, to, fulfillmentType);
}

/**
 * Every stage this order could be corrected back to, earliest first.
 *
 * The staff screen draws one control per entry, so this is also the answer to
 * "what may I choose from" — the interface cannot offer a move the machine
 * would refuse, because it asks the machine what to offer.
 */
export function revertTargets(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): OrderStatus[] {
  return orderFlow(fulfillmentType).filter((stage) =>
    canRevert(status, stage, fulfillmentType),
  );
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
  const to = NEXT[fulfillmentType][status];
  if (!to) return null;

  const label =
    to === "confirmed"
      ? "Confirm order"
      : to === "preparing"
        ? "Start preparing"
        : to === "ready"
          ? "Mark ready"
          : to === "outForDelivery"
            ? "Send out for delivery"
            : fulfillmentType === "delivery"
              ? "Mark delivered"
              : "Mark collected";

  return { to, label };
}
