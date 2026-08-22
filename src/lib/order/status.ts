import type { FulfillmentType, Order, OrderStatus } from "../types";

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
 * Delivery splits the tail: the food is ready, then it travels.
 */
const SCHEDULE = {
  preparing: 0.08,
  ready: 0.6,
  /** Delivery only — the courier leaves once the food is ready. */
  outForDelivery: 0.75,
} as const;

export function deriveStatus(
  order: Pick<Order, "createdAt" | "estimatedReadyAt" | "fulfillment" | "status">,
  now: Date = new Date(),
): OrderStatus {
  // A cancelled order is a fact, not a stage — never override it.
  if (order.status === "cancelled") return "cancelled";

  const created = new Date(order.createdAt).getTime();
  const ready = new Date(order.estimatedReadyAt).getTime();
  const lead = ready - created;

  // Guard against a zero or negative window (a slot in the past, a clock skew):
  // treat it as complete rather than dividing by zero.
  if (!Number.isFinite(lead) || lead <= 0) return "completed";

  const progress = (now.getTime() - created) / lead;
  const isDelivery = order.fulfillment.type === "delivery";

  if (progress >= 1) return "completed";
  if (isDelivery && progress >= SCHEDULE.outForDelivery) return "outForDelivery";
  if (progress >= SCHEDULE.ready) return "ready";
  if (progress >= SCHEDULE.preparing) return "preparing";
  return "confirmed";
}

/** The stages an order of this kind passes through, in order. */
export function timelineFor(fulfillmentType: FulfillmentType): OrderStatus[] {
  const common: OrderStatus[] = ["confirmed", "preparing", "ready"];
  return fulfillmentType === "delivery"
    ? [...common, "outForDelivery", "completed"]
    : [...common, "completed"];
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

/** How far through the timeline an order is, for progress indicators. */
export function timelineIndex(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): number {
  return timelineFor(fulfillmentType).indexOf(status);
}
