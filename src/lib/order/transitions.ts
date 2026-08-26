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
 * The whole rule, in one predicate.
 *
 * Exactly two moves are legal from any stage: one step forward along this
 * order's own path, or cancel. Everything else — backwards, skipping ahead, a
 * status onto itself, anything out of a terminal state, and "out for delivery"
 * on an order nobody is delivering — is false.
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
