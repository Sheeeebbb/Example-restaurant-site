import { NextResponse } from "next/server";
import { listOrders } from "@/lib/order/order-repository";
import { calculateStats } from "@/lib/admin/stats";
import { requirePermission } from "@/lib/staff/authorize";
import { listStaff } from "@/lib/staff/staff-repository";

/**
 * The kitchen's view of every order, with the dashboard figures alongside.
 *
 * Requires `orders.view`, checked here rather than inherited from anywhere:
 * `proxy.ts` only knows whether someone is plausibly signed in, and "signed in"
 * is not "allowed". A driver whose role has `deliveries.view` but not
 * `orders.view` gets a 403 from this endpoint and uses `/api/admin/deliveries`
 * instead, which shows them what they need and nothing else.
 *
 * Returns full customer details — name, phone, address — because the kitchen
 * needs them to cook and deliver. That is precisely why it sits behind a
 * permission, and why the public tracking endpoint returns status alone.
 */
export async function GET() {
  const auth = await requirePermission("orders.view");
  if (!auth.ok) return auth.response;

  const orders = await listOrders();

  /*
   * Who is on which delivery, resolved once.
   *
   * Orders store a staff id and not a name, so the board would otherwise show
   * an opaque identifier. Only the id and name go out — not usernames, not
   * roles, not anything else about a colleague.
   */
  const assignees = Object.fromEntries(
    (await listStaff()).map((member) => [member.id, member.name]),
  );

  return NextResponse.json({
    ok: true,
    orders,
    stats: calculateStats(orders),
    assignees,
    /* What the caller may do, so the board can draw itself. Advisory only —
       every action is re-checked when it is attempted. */
    permissions: [...auth.actor.permissions].sort(),
    actorId: auth.actor.staff.id,
  });
}
