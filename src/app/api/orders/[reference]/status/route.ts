import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order/order-repository";
import { deriveStatus } from "@/lib/order/status";

/**
 * The customer-facing status endpoint.
 *
 * PUBLIC — anyone holding an order reference can call it. That is why it
 * returns the status and nothing else: no name, no phone, no address, no
 * items, no total. An order reference is a weak bearer token, so it must not
 * unlock personal information by itself.
 *
 * The customer's own copy of their order (items, address, receipt) lives in
 * their browser from when they placed it. This endpoint exists only so a status
 * the kitchen sets reaches the page they are already looking at.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const order = await getOrder(reference);

  if (!order) {
    return NextResponse.json({ ok: false, error: "No such order." }, { status: 404 });
  }

  const status = deriveStatus(order);

  return NextResponse.json({
    ok: true,
    status,
    // True once staff have moved it by hand, so the page can stop simulating.
    setByStaff: order.history.some((event) => event.by === "staff"),
    /*
     * The cancellation, if there was one.
     *
     * This is the one piece of staff-written text that belongs to the customer:
     * the reason exists to be shown to them, and the staff form says so before
     * anyone types it. It is sent only on a cancelled order, and nothing else
     * from the audit trail comes with it — no other note, no author, no
     * timestamps beyond the cancellation's own.
     */
    ...(status === "cancelled"
      ? {
          cancellationReason: order.cancellationReason ?? null,
          cancelledAt: order.cancelledAt ?? null,
        }
      : {}),
  });
}
