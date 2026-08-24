import type { FulfillmentType, Order, OrderStatus } from "../types";
import { ORDER_FLOW, nextStatus } from "./transitions";

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
 * The same fractions for delivery and pickup, because the stages are now the
 * same for both — see `ORDER_FLOW` in `transitions.ts`.
 */
const SCHEDULE = {
  preparing: 0.08,
  ready: 0.6,
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
  if (progress >= SCHEDULE.ready) return "ready";
  if (progress >= SCHEDULE.preparing) return "preparing";
  return "confirmed";
}

/**
 * The stages an order passes through, in order.
 *
 * Read straight off the state machine, so the customer's tracker and the
 * kitchen's buttons can never describe different journeys.
 *
 * Takes no fulfilment type, and that is the point: delivery and pickup follow
 * the same four stages now. Only the wording of the last one differs — and
 * naming it is `statusLabel`'s job, not this one's.
 */
export function timelineFor(): OrderStatus[] {
  return [...ORDER_FLOW];
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
      // A retired stage. Only orders placed before delivery and pickup were
      // brought onto one path can still be sitting in it.
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
        ? "Your food is ready and waiting for a driver."
        : "Come and collect whenever you're ready.";
    case "outForDelivery":
      return "On its way to you now.";
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
 * −1 for a status that is not a stage — `cancelled`, or the retired
 * `outForDelivery`. Callers must handle that rather than lighting stage zero:
 * a cancelled order has not "reached order received", it has left the track.
 */
export function timelineIndex(status: OrderStatus): number {
  return timelineFor().indexOf(status);
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

  const stages = timelineFor();
  const fromStage = stages.indexOf(from);
  const toStage = stages.indexOf(to);
  if (fromStage !== -1 && toStage !== -1 && toStage < fromStage) {
    return `An order can't go back to ${toLabel} once it's ${fromLabel.toLowerCase()}.`;
  }

  const step = nextStatus(from);
  if (step) {
    return `${fromLabel} moves to ${statusLabel(step, fulfillmentType).toLowerCase()} next — one step at a time.`;
  }
  return `${fromLabel} can't move to ${toLabel}.`;
}
