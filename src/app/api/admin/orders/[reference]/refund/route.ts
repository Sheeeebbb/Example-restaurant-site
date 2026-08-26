import { NextResponse } from "next/server";
import { getOrder, retryRefund } from "@/lib/order/order-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { recordAudit } from "@/lib/staff/staff-repository";

/**
 * Asks the payment provider again for a refund that failed.
 *
 * Its own permission, separate from `orders.cancel`, and this is the difference
 * between them: cancelling raises a refund automatically, as a consequence of
 * ending the order, and anyone trusted to cancel is trusted with that. Reaching
 * back into a payment that has already failed and asking the provider to move
 * money again is a deliberate act on the payment system, and it is what
 * `refunds.initiate` governs.
 *
 * It cannot invent a refund for an order that was never cancelled, and it
 * cannot re-refund one that already succeeded — both are refused below, so the
 * permission is not a way to send money to arbitrary orders.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requirePermission("refunds.initiate");
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  const order = await getOrder(reference);
  if (!order) {
    return NextResponse.json({ ok: false, error: "No such order." }, { status: 404 });
  }

  const result = await retryRefund(reference);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: "refund.retried",
    subject: reference,
    summary: `Retried the refund on ${reference}; the provider said ${result.order.refund?.status}.`,
  });

  return NextResponse.json({ ok: true, order: result.order });
}
