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
  outForDelivery: number;
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

  // Cancelled orders took no money, so they must not count toward revenue —
  // but they did happen, so they stay in the order count.
  const earning = today.filter((order) => order.status !== "cancelled");
  const revenueToday = earning.reduce((total, order) => total + order.totals.total, 0);

  let preparing = 0;
  let awaitingPickup = 0;
  let outForDelivery = 0;

  for (const order of orders) {
    const status = deriveStatus(order, now);
    if (status === "preparing") preparing += 1;
    else if (status === "ready" && order.fulfillment.type === "pickup") {
      awaitingPickup += 1;
    } else if (status === "outForDelivery") outForDelivery += 1;
  }

  return {
    ordersToday: today.length,
    revenueToday,
    preparing,
    awaitingPickup,
    outForDelivery,
    averageOrderValue:
      earning.length > 0 ? Math.round(revenueToday / earning.length) : 0,
  };
}
