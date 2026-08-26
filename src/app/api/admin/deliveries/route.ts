import { NextResponse } from "next/server";
import { listOrders } from "@/lib/order/order-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { listStaff } from "@/lib/staff/staff-repository";
import type { Order } from "@/lib/types";

/**
 * The driver's board: what is waiting, and what is theirs.
 *
 * A separate endpoint from `/api/admin/orders` rather than a filter on it, so a
 * delivery role never needs `orders.view`. That permission carries the whole
 * queue including pickup orders and every customer's details; this one carries
 * the deliveries and only the fields a driver uses to complete them.
 *
 * Which is the point of granular permissions: the narrow job gets the narrow
 * endpoint, and nobody has to be over-privileged to do it.
 */
export interface DeliveryView {
  reference: string;
  status: Order["status"];
  createdAt: string;
  estimatedReadyAt: string;
  customerName: string;
  customerPhone: string;
  address: Order["fulfillment"]["address"];
  itemCount: number;
  assignedStaffId?: string;
  assignedStaffName?: string;
}

export async function GET() {
  const auth = await requirePermission("deliveries.view");
  if (!auth.ok) return auth.response;

  const names = new Map((await listStaff()).map((member) => [member.id, member.name]));
  const orders = await listOrders();

  /*
   * Deliveries that are still live, and nothing else.
   *
   * A finished or cancelled order is not a delivery any more, and a pickup
   * never was. Trimmed to the fields a run needs — no payment record, no
   * refund state, no line prices — because a driver's session should not be
   * able to read them even by accident.
   */
  const deliveries: DeliveryView[] = orders
    .filter(
      (order) =>
        order.fulfillment.type === "delivery" &&
        order.status !== "cancelled" &&
        order.status !== "completed",
    )
    .map((order) => ({
      reference: order.reference,
      status: order.status,
      createdAt: order.createdAt,
      estimatedReadyAt: order.estimatedReadyAt,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      address: order.fulfillment.address,
      itemCount: order.lines.reduce((total, line) => total + line.quantity, 0),
      assignedStaffId: order.assignedStaffId,
      assignedStaffName: order.assignedStaffId
        ? names.get(order.assignedStaffId)
        : undefined,
    }));

  return NextResponse.json({
    ok: true,
    deliveries,
    actorId: auth.actor.staff.id,
    permissions: [...auth.actor.permissions].sort(),
  });
}
