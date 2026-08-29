import type { FulfillmentType, OrderStatus } from "../lib/types";

/**
 * Turning an order's status into words, in the reader's language.
 *
 * ── What is NOT translated ──────────────────────────────────────────────────
 * The status itself. `"preparing"` is the value in the database, on the wire,
 * in the state machine and in every permission check, and it is the same string
 * in every language. Nothing here writes back; this is the last step before a
 * pixel. A translated label must never become a stored status, or the kitchen
 * board and the customer's tracker would stop agreeing about what an order is.
 *
 * ── Why pickup differs ──────────────────────────────────────────────────────
 * "Ready" and "Delivered" are wrong for an order the customer is collecting:
 * it is "Ready to collect" and then "Collected". Dutch makes the same
 * distinction — "Klaar om af te halen" and "Opgehaald" — so the split is in the
 * key, not in the sentence.
 */

/** The message key for a status, given how the order is being fulfilled. */
export function statusKey(status: OrderStatus, fulfillmentType: FulfillmentType): string {
  const isPickup = fulfillmentType === "pickup";
  if (status === "ready") return isPickup ? "readyPickup" : "ready";
  if (status === "completed") return isPickup ? "completedPickup" : "completed";
  return status;
}

/**
 * A translator for the `order.status` namespace.
 *
 * Typed loosely on purpose: `useTranslations("order.status")` and
 * `getTranslations("order.status")` both satisfy it, so a component and a
 * server action can share one helper.
 */
export type StatusTranslator = (key: string) => string;

export function translateStatus(
  t: StatusTranslator,
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): string {
  return t(statusKey(status, fulfillmentType));
}
