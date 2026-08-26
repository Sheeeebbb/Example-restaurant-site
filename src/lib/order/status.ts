import type { FulfillmentType, Order, OrderStatus } from "../types";
import { nextStatus, orderFlow } from "./transitions";

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

  const stages = timelineFor(fulfillmentType);
  const fromStage = stages.indexOf(from);
  const toStage = stages.indexOf(to);
  if (fromStage !== -1 && toStage !== -1 && toStage < fromStage) {
    return `An order can't go back to ${toLabel} once it's ${fromLabel.toLowerCase()}.`;
  }

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
