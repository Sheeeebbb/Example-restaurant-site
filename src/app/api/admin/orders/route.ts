import { NextResponse } from "next/server";
import { listOrders } from "@/lib/order/order-repository";
import { calculateStats } from "@/lib/admin/stats";

/**
 * The kitchen's view of every order, with the dashboard figures alongside.
 *
 * Guarded by `proxy.ts`; this handler performs no check of its own, so there is
 * exactly one place where staff access is decided.
 *
 * Returns full customer details — name, phone, address — because the kitchen
 * needs them to cook and deliver. That is precisely why it sits behind the
 * gate, and why the public tracking endpoint returns status alone.
 */
export async function GET() {
  const orders = await listOrders();
  return NextResponse.json({ ok: true, orders, stats: calculateStats(orders) });
}
