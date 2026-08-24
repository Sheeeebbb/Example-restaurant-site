import { NextResponse } from "next/server";
import {
  advanceOrder,
  cancelOrder,
  getOrder,
  transitionOrder,
  type OrderTransitionResult,
} from "@/lib/order/order-repository";
import type { OrderStatus } from "@/lib/types";

const KNOWN_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "outForDelivery",
  "completed",
  "cancelled",
];

/** Cancellation reasons are shown to a customer, so they get a sane ceiling. */
const MAX_REASON = 500;

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
 * Moves an order along, or cancels it.
 *
 * Two intents, and they are separate on purpose:
 *
 *   { "action": "advance" }                     — one step, whatever comes next
 *   { "action": "cancel", "reason": "…" }       — ends the order
 *
 * `advance` never names a destination. The caller cannot ask for a stage; it
 * asks for *the next one*, and the state machine decides what that is — so
 * "skip to delivered" is not a request this endpoint can express.
 *
 * An explicit `{ "status": … }` is still accepted, because a request that names
 * a status is exactly what an old client or a hand-rolled call will send, and
 * it should be REFUSED clearly rather than silently doing something else. It
 * goes through the same `transitionOrder`, so a backwards or skipped move comes
 * back 409 with the reason.
 *
 * Either way the decision is not made here. This route parses and reports; the
 * rule lives in `lib/order/transitions.ts` and is applied in the repository, so
 * no interface — this one included — can talk its way around it.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  let body: { action?: string; status?: OrderStatus; reason?: string; from?: OrderStatus };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  // Optional: what the caller believed the order was in when it drew the
  // button. Lets a stale kitchen screen be told rather than obeyed.
  const from =
    body.from && KNOWN_STATUSES.includes(body.from) ? body.from : undefined;

  let result: OrderTransitionResult;

  if (body.action === "advance") {
    result = await advanceOrder(reference, from);
  } else if (body.action === "cancel") {
    const reason = body.reason?.trim() ?? "";
    if (!reason) {
      return NextResponse.json(
        { ok: false, error: "Give a reason for the cancellation — the customer is shown it." },
        { status: 422 },
      );
    }
    if (reason.length > MAX_REASON) {
      return NextResponse.json(
        { ok: false, error: `Keep the reason under ${MAX_REASON} characters.` },
        { status: 422 },
      );
    }
    result = await cancelOrder(reference, reason, from);
  } else if (body.status) {
    if (!KNOWN_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: "That isn't a status an order can be in." },
        { status: 422 },
      );
    }
    result = await transitionOrder(reference, body.status, {
      reason: body.reason,
      expectedFrom: from,
    });
  } else {
    return NextResponse.json(
      { ok: false, error: 'Send { "action": "advance" } or { "action": "cancel", "reason": … }.' },
      { status: 400 },
    );
  }

  if (result.ok) {
    return NextResponse.json({ ok: true, order: result.order });
  }

  // 409, not 422: the request was well formed and the status was real. What
  // failed is that this order, as it stands, cannot make that move — and the
  // order comes back with the refusal so a stale screen can right itself.
  const httpStatus = result.reason === "not-found" ? 404 : 409;
  return NextResponse.json(
    { ok: false, error: result.error, order: result.order },
    { status: httpStatus },
  );
}
