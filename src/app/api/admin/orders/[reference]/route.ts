import { NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/order/order-repository";
import type { OrderStatus } from "@/lib/types";

const ALLOWED: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "outForDelivery",
  "completed",
  "cancelled",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const order = await getOrder(reference);
  if (!order) {
    return NextResponse.json({ ok: false, error: "No such order." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}

/**
 * Moves an order to a new status.
 *
 * The status is checked against the known set rather than trusted, so a typo or
 * a hand-made request cannot put an order into a state nothing else can read.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  let status: OrderStatus | undefined;
  let note: string | undefined;
  try {
    ({ status, note } = (await request.json()) as {
      status?: OrderStatus;
      note?: string;
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json(
      { ok: false, error: "That isn't a status an order can be in." },
      { status: 422 },
    );
  }

  const order = await updateOrderStatus(reference, status, note);
  if (!order) {
    return NextResponse.json({ ok: false, error: "No such order." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order });
}
