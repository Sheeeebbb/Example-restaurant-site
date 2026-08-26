import { NextResponse } from "next/server";
import { claimDelivery, releaseDelivery, getOrder } from "@/lib/order/order-repository";
import { requirePermission } from "@/lib/staff/authorize";
import { recordAudit } from "@/lib/staff/staff-repository";

/**
 * A driver claims a delivery, or hands it back.
 *
 * The claim is made for the CALLER — the staff id comes from the session, not
 * from the request. There is no body field naming who is claiming, so there is
 * nothing to forge: a driver cannot assign a run to someone else, and cannot
 * assign one to themselves under another name.
 *
 * Two drivers pressing at the same moment is the real case, and it is settled
 * in `claimDelivery` by a check-and-set with no await between the two halves.
 * The loser gets 409 and the truth, not a delivery they do not have.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requirePermission("deliveries.accept");
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  const result = await claimDelivery(reference, auth.actor.staff.id);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.reason === "not-found" ? 404 : 409 },
    );
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: "delivery.claimed",
    subject: reference,
    summary: `Accepted delivery ${reference}.`,
  });

  return NextResponse.json({ ok: true, order: result.order });
}

/**
 * Gives a delivery back to the pool.
 *
 * A driver may release their own — a bike with a flat tyre is a normal event.
 * Taking one off someone else is an administrative act and needs the broad
 * status permission, because it changes another person's work.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requirePermission("deliveries.accept");
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  const order = await getOrder(reference);
  if (!order) {
    return NextResponse.json({ ok: false, error: "No such order." }, { status: 404 });
  }

  const isOwn = order.assignedStaffId === auth.actor.staff.id;
  if (!isOwn && !auth.actor.can("orders.status.out_for_delivery")) {
    return NextResponse.json(
      {
        ok: false,
        error: "That delivery is assigned to someone else. Only they, or a manager, can hand it back.",
      },
      { status: 403 },
    );
  }

  const result = await releaseDelivery(reference);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  recordAudit({
    actorId: auth.actor.staff.id,
    actorName: auth.actor.staff.name,
    action: "delivery.released",
    subject: reference,
    summary: isOwn
      ? `Handed delivery ${reference} back to the pool.`
      : `Took delivery ${reference} off another driver.`,
  });

  return NextResponse.json({ ok: true, order: result.order });
}
