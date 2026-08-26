import type { FulfillmentType, Order, OrderStatus } from "../types";
import { isBackwards } from "./transitions";

/**
 * Which permission each order action needs.
 *
 * Pure, and shared by the API routes that enforce it and the screens that decide
 * what to offer — so a button is drawn under exactly the rule that will be
 * applied when it is pressed. The screen asking is a convenience; the route
 * asking is the control.
 *
 * ── Two ways to reach the same stage ───────────────────────────────────────
 * "Out for delivery" and "Delivered" are reachable by two different kinds of
 * staff for two different reasons, and the difference matters:
 *
 *   a manager   holds `orders.status.out_for_delivery` and may set ANY order
 *               out, because running the shift sometimes means fixing what a
 *               driver could not;
 *   a driver    holds `deliveries.out_for_delivery` and may set out only an
 *               order assigned to them, because that is the one they have.
 *
 * Modelled as alternative grants rather than a third permission meaning "either
 * of those", so a role can be given one, the other, or both, and the narrow one
 * stays narrow.
 */

export interface StatusGrant {
  permission: string;
  /** True when the grant only covers orders assigned to the actor themselves. */
  ownDeliveryOnly?: boolean;
}

/**
 * The broad grant.
 *
 * Satisfies any stage on the normal path, so a role can be given "may move
 * orders through the kitchen" without listing five permissions. Held INSTEAD of
 * the granular ones, not as well — a role with both is not more powerful.
 */
const BROAD_STATUS_PERMISSION = "orders.change_status";

/** Alternative grants that authorise moving an order TO this status. */
export function grantsForStatus(to: OrderStatus): StatusGrant[] {
  switch (to) {
    case "pending":
    case "confirmed":
      return [{ permission: "orders.status.received" }];
    case "preparing":
      return [{ permission: "orders.status.preparing" }];
    case "ready":
      return [{ permission: "orders.status.ready" }];
    case "outForDelivery":
      return [
        { permission: "orders.status.out_for_delivery" },
        { permission: "deliveries.out_for_delivery", ownDeliveryOnly: true },
      ];
    case "completed":
      return [
        { permission: "orders.status.delivered" },
        { permission: "deliveries.confirm_delivery", ownDeliveryOnly: true },
      ];
    case "cancelled":
      return [{ permission: "orders.cancel" }];
  }
}

export interface PermissionActor {
  id: string;
  permissions: Set<string>;
}

export type StatusAuthorization =
  | { allowed: true }
  | { allowed: false; error: string };

/**
 * May this actor move this order to this status?
 *
 * Answers the authorisation question ONLY. Whether the move is legal at all —
 * forwards, backwards, skipping, out of a terminal state — is the state
 * machine's business and is checked separately in the repository. Both have to
 * say yes, and they are asked in that order so a staff member who lacks a
 * permission is told that rather than being told the order cannot move.
 */
export function authorizeStatusChange({
  order,
  to,
  actor,
}: {
  order: Pick<Order, "status" | "fulfillment" | "assignedStaffId">;
  to: OrderStatus;
  actor: PermissionActor;
}): StatusAuthorization {
  const from = order.status;
  const fulfillmentType: FulfillmentType = order.fulfillment.type;

  /*
   * Going backwards needs its own permission ON TOP of the target's.
   *
   * Both, not either: correcting an order to "preparing" is still putting it
   * into the kitchen, so whoever does it needs to be allowed to do that as well
   * as to be allowed to correct. A role given only `orders.status.backward`
   * can move nothing.
   */
  if (isBackwards(from, to, fulfillmentType) && !actor.permissions.has("orders.status.backward")) {
    return {
      allowed: false,
      error:
        'Your role doesn\'t include "orders.status.backward", which is needed to move an order back to an earlier stage.',
    };
  }

  const grants = grantsForStatus(to);
  const broad =
    to !== "cancelled" && actor.permissions.has(BROAD_STATUS_PERMISSION);

  if (broad) return { allowed: true };

  for (const grant of grants) {
    if (!actor.permissions.has(grant.permission)) continue;
    if (grant.ownDeliveryOnly && order.assignedStaffId !== actor.id) continue;
    return { allowed: true };
  }

  /*
   * Why it was refused, told apart.
   *
   * Holding the delivery permission but not the assignment is a different
   * problem from not holding it — one is fixed by claiming the order, the other
   * by asking a manager — and a driver looking at a red message needs to know
   * which.
   */
  const heldButUnassigned = grants.some(
    (grant) => grant.ownDeliveryOnly && actor.permissions.has(grant.permission),
  );
  if (heldButUnassigned) {
    return {
      allowed: false,
      error:
        "This delivery isn't assigned to you. Accept it first, or ask whoever has it.",
    };
  }

  return {
    allowed: false,
    error: `Your role doesn't include ${grants
      .map((grant) => `"${grant.permission}"`)
      .join(" or ")}${to === "cancelled" ? "" : ` or "${BROAD_STATUS_PERMISSION}"`}.`,
  };
}

/**
 * The stages this actor could move this order to, for drawing an interface.
 *
 * Same function the route will use, asked speculatively. A screen that offers
 * only what this returns never shows a control that would be refused — and a
 * screen that ignored it would still be refused.
 */
export function permittedTargets(
  order: Pick<Order, "status" | "fulfillment" | "assignedStaffId">,
  actor: PermissionActor,
  candidates: OrderStatus[],
): OrderStatus[] {
  return candidates.filter(
    (to) => authorizeStatusChange({ order, to, actor }).allowed,
  );
}
