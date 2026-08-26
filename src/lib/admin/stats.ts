import type { Cents, Order } from "../types";
import { deriveStatus } from "../order/status";

/**
 * Dashboard figures.
 *
 * Pure, so the numbers can be tested without a browser. Each order's status is
 * read through `deriveStatus`, which means the board reflects what the customer
 * is being told — including simulated progress on orders staff haven't touched.
 * Reading the stored `status` field instead would show every untouched order as
 * "confirmed" forever.
 */

export interface DashboardStats {
  ordersToday: number;
  revenueToday: Cents;
  preparing: number;
  awaitingPickup: number;
  /** Cooked, boxed, and waiting for someone to take it out. */
  awaitingDriver: number;
  /** Average order value today, for the revenue card's subtitle. */
  averageOrderValue: Cents;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function calculateStats(
  orders: Order[],
  now: Date = new Date(),
): DashboardStats {
  const today = orders.filter((order) => isSameDay(new Date(order.createdAt), now));

  // A cancelled order is refunded, so it earns the restaurant nothing and must
  // not count toward revenue — but it did happen, so it stays in the order
  // count. `awaitingDriver` below is still orders sitting cooked on the pass:
  // one that has gone out is with a driver, not waiting for one.
  const earning = today.filter((order) => order.status !== "cancelled");
  const revenueToday = earning.reduce((total, order) => total + order.totals.total, 0);

  let preparing = 0;
  let awaitingPickup = 0;
  let awaitingDriver = 0;

  // "Ready" splits by how the food leaves the building: a pickup order is
  // waiting on the customer, a delivery order is waiting on a driver, and a
  // kitchen chases those two very differently.
  for (const order of orders) {
    const status = deriveStatus(order, now);
    if (status === "preparing") preparing += 1;
    else if (status === "ready") {
      if (order.fulfillment.type === "pickup") awaitingPickup += 1;
      else awaitingDriver += 1;
    }
  }

  return {
    ordersToday: today.length,
    revenueToday,
    preparing,
    awaitingPickup,
    awaitingDriver,
    averageOrderValue:
      earning.length > 0 ? Math.round(revenueToday / earning.length) : 0,
  };
}
