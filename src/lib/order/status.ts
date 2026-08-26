import type { FulfillmentType, Order, OrderStatus } from "../types";
import { isBackwards, nextStatus, orderFlow } from "./transitions";

/**
 * Simulated order progress.
 *
 * Status is DERIVED from the clock rather than stored and advanced by a timer.
 * A timer would reset on every refresh — the customer would watch their order
 * go back to "received" each time they reloaded. Deriving it from `createdAt`
 * and `estimatedReadyAt` means the same moment always produces the same status,
 * on any device, after any number of refreshes.
 *
 * When a real kitchen is wired up, this function is replaced by the status the
 * staff actually set. Everything downstream — the timeline, the labels — reads
 * an `OrderStatus` either way, so only this file changes.
 */

/**
 * Fractions of the order's total lead time at which each stage begins.
 *
 * A delivery order's lead time is prep PLUS travel (see `leadTimeMinutes`), so
 * `estimatedReadyAt` is when the food reaches the customer, not when it leaves
 * the kitchen. That last stretch is the drive — which is why the delivery
 * schedule has a stage the pickup one does not, and why it starts near the end.
 *
 * The pickup fractions are untouched: nothing about collecting an order has
 * changed.
 */
const SCHEDULE = {
  delivery: {
    preparing: 0.08,
    ready: 0.6,
    outForDelivery: 0.72,
  },
  pickup: {
    preparing: 0.08,
    ready: 0.6,
  },
} as const;

export function deriveStatus(
  order: Pick<
    Order,
    "createdAt" | "estimatedReadyAt" | "fulfillment" | "status" | "history"
  >,
  now: Date = new Date(),
): OrderStatus {
  // A cancelled order is a fact, not a stage — never override it.
  if (order.status === "cancelled") return "cancelled";

  // Once the kitchen has touched this order, stop guessing. Simulated progress
  // exists only to make an untouched demo order look alive; a real status set
  // by staff always wins, even if the clock disagrees with it.
  if (order.history?.some((event) => event.by === "staff")) return order.status;

  const created = new Date(order.createdAt).getTime();
  const ready = new Date(order.estimatedReadyAt).getTime();
  const lead = ready - created;

  // Guard against a zero or negative window (a slot in the past, a clock skew):
  // treat it as complete rather than dividing by zero.
  if (!Number.isFinite(lead) || lead <= 0) return "completed";

  const progress = (now.getTime() - created) / lead;

  if (progress >= 1) return "completed";
  if (order.fulfillment.type === "delivery") {
    if (progress >= SCHEDULE.delivery.outForDelivery) return "outForDelivery";
    if (progress >= SCHEDULE.delivery.ready) return "ready";
    if (progress >= SCHEDULE.delivery.preparing) return "preparing";
    return "confirmed";
  }

  if (progress >= SCHEDULE.pickup.ready) return "ready";
  if (progress >= SCHEDULE.pickup.preparing) return "preparing";
  return "confirmed";
}

/**
 * The stages an order passes through, in order.
 *
 * Read straight off the state machine, so the customer's tracker and the
 * kitchen's buttons can never describe different journeys — including the fact
 * that a delivery has one stage more than a collection.
 */
export function timelineFor(fulfillmentType: FulfillmentType): OrderStatus[] {
  return [...orderFlow(fulfillmentType)];
}

/**
 * Labels differ by fulfilment: "Out for delivery" is meaningless on a pickup
 * order, and "Delivered" is wrong when the customer collected it themselves.
 */
export function statusLabel(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): string {
  const isDelivery = fulfillmentType === "delivery";
  switch (status) {
    case "pending":
      return "Awaiting payment";
    case "confirmed":
      return "Order received";
    case "preparing":
      return "Preparing";
    case "ready":
      return isDelivery ? "Ready" : "Ready for pickup";
    case "outForDelivery":
      return "Out for delivery";
    case "completed":
      return isDelivery ? "Delivered" : "Collected";
    case "cancelled":
      return "Cancelled";
  }
}

export function statusDescription(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): string {
  const isDelivery = fulfillmentType === "delivery";
  switch (status) {
    case "confirmed":
      return "We've got your order and the kitchen has it on screen.";
    case "preparing":
      return "Everything is being cooked to order right now.";
    case "ready":
      return isDelivery
        ? "Your food is cooked and ready to leave the restaurant."
        : "Come and collect whenever you're ready.";
    case "outForDelivery":
      return "It has left the restaurant and is on its way to you now.";
    case "completed":
      return isDelivery ? "Delivered. Enjoy." : "Collected. Enjoy.";
    case "cancelled":
      return "This order was cancelled.";
    default:
      return "";
  }
}

/**
 * How far through the timeline an order is, for progress indicators.
 *
 * −1 for a status that is not a stage of THIS order's journey — `cancelled`,
 * or `outForDelivery` on a collection. Callers must handle that rather than
 * lighting stage zero: a cancelled order has not "reached order received", it
 * has left the track.
 */
/**
 * Why a correction was refused.
 *
 * The other half of `explainRefusal`: that one answers "why won't it move on",
 * this one answers "why won't it move back", and they are different questions
 * with different right answers. A cancelled order is the one that matters —
 * staff reach for a correction when they meant to reinstate, and the reply has
 * to say that reinstating is not a thing this system does.
 */
export function explainRevertRefusal(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): string {
  const fromLabel = statusLabel(from, fulfillmentType);
  const toLabel = statusLabel(to, fulfillmentType).toLowerCase();

  if (from === "cancelled") {
    return "This order was cancelled and refunded. A cancellation can't be corrected away — if the customer still wants the food, take a new order.";
  }
  if (to === "cancelled") {
    return "Cancelling isn't a stage to move back to. Use the cancel action, which asks for a reason and refunds the payment.";
  }
  if (from === to) {
    return `This order is already ${fromLabel.toLowerCase()}.`;
  }
  if (timelineIndex(to, fulfillmentType) === -1) {
    return `${toLabel[0].toUpperCase()}${toLabel.slice(1)} isn't a stage of a ${
      fulfillmentType === "delivery" ? "delivery" : "collection"
    } order.`;
  }
  return `${toLabel[0].toUpperCase()}${toLabel.slice(1)} is not behind ${fromLabel.toLowerCase()} — to move an order on, use the next step.`;
}

/**
 * The confirmation shown before an order is moved backwards.
 *
 * Lives here with the other wording so the sentence a staff member reads and
 * the rule the server applies are derived from the same two statuses, and so
 * this can be tested without rendering anything.
 *
 * A delivered order gets its own, blunter first line. Everything else on this
 * screen is a correction to work in progress; that one is a claim about
 * something the customer has already been told is finished, and it should not
 * read like the others.
 */
export function revertWarning(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): { title: string; detail: string; consequence: string } {
  const fromLabel = statusLabel(from, fulfillmentType);
  const toLabel = statusLabel(to, fulfillmentType);
  const finished = from === "completed";

  return {
    title: finished
      ? `This order is already marked ${fromLabel.toLowerCase()}.`
      : "Move order backwards?",
    detail: `You are changing this order from "${fromLabel}" back to "${toLabel}".`,
    consequence: finished
      ? `The customer has been told it was ${fromLabel.toLowerCase()}. Moving it back changes what their tracking shows and puts the order back into the kitchen's queue.`
      : "This may affect the customer's order tracking and staff workflow.",
  };
}

export function timelineIndex(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): number {
  return timelineFor(fulfillmentType).indexOf(status);
}

/**
 * Why a move was refused, in words a person can act on.
 *
 * Lives here rather than with the machine because it needs the kitchen's own
 * labels, and the machine deliberately knows nothing about wording. Only ever
 * called on the failing path, so it can afford to work out which kind of wrong
 * the attempt was: going backwards reads very differently from touching an
 * order that finished an hour ago.
 */
export function explainRefusal(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
): string {
  const fromLabel = statusLabel(from, fulfillmentType);
  const toLabel = statusLabel(to, fulfillmentType).toLowerCase();

  if (from === to) {
    return `This order is already ${fromLabel.toLowerCase()}.`;
  }
  if (from === "cancelled") {
    return "This order was cancelled, and a cancelled order can't be reopened.";
  }
  if (from === "completed") {
    return `This order is already ${fromLabel.toLowerCase()}, so it can't be moved again.`;
  }

  if (isBackwards(from, to, fulfillmentType)) {
    // Not "you can't" — you can, but not like this. Correcting a status is its
    // own action, and the message says which one rather than leaving whoever
    // hit this to conclude the order is stuck.
    return `Moving an order back to ${toLabel} is a correction, not a step — confirm it from the order's status panel.`;
  }

  const stages = timelineFor(fulfillmentType);
  const toStage = stages.indexOf(to);

  // A stage that isn't on this order's path at all — "out for delivery" on a
  // collection — needs saying plainly, or the message reads as a scheduling
  // quibble about something that is never going to happen.
  if (toStage === -1 && to !== "cancelled") {
    return `${toLabel[0].toUpperCase()}${toLabel.slice(1)} isn't a stage of a ${
      fulfillmentType === "delivery" ? "delivery" : "collection"
    } order.`;
  }

  const step = nextStatus(from, fulfillmentType);
  if (step) {
    return `${fromLabel} moves to ${statusLabel(step, fulfillmentType).toLowerCase()} next — one step at a time.`;
  }
  return `${fromLabel} can't move to ${toLabel}.`;
}
