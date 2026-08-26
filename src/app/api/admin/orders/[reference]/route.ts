import { NextResponse } from "next/server";
import {
  advanceOrder,
  cancelOrder,
  getOrder,
  revertOrder,
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

/**
 * Who may call any of this.
 *
 * Nobody, without a staff session: `src/proxy.ts` matches `/api/admin/:path*`
 * and returns 401 before this file runs. That is the application's single
 * authorisation gate, and it is deliberately not repeated here — a handler that
 * does its own check is a handler that can forget to.
 *
 * Which means the confirmation dialog in front of a backwards move is a
 * courtesy to the person pressing the button, and nothing else is resting on
 * it. What actually stops an unauthorised or accidental reversal is this route
 * being unreachable without a session, and a reversal requiring an action verb
 * of its own that no ordinary request can produce by mistake.
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
  return NextResponse.json({ ok: true, order });
}

/**
 * Moves an order along, or cancels it.
 *
 * Two intents, and they are separate on purpose:
 *
 *   { "action": "advance" }                          — one step, whatever comes next
 *   { "action": "revert", "to": …, "from": … }       — back to an earlier stage
 *   { "action": "cancel", "reason": "…" }            — ends the order
 *
 * `advance` never names a destination. The caller cannot ask for a stage; it
 * asks for *the next one*, and the state machine decides what that is — so
 * "skip to delivered" is not a request this endpoint can express.
 *
 * `revert` is the opposite: it must name both ends. It is the only shape that
 * can move an order backwards, and it is separate from `advance` precisely so
 * that going back cannot happen as a side effect of getting a forward request
 * wrong. `from` is required rather than optional here — a correction is always
 * about a specific wrong reading, and one that cannot say which is a guess.
 *
 * An explicit `{ "status": … }` is still accepted, because a request that names
 * a status is exactly what an old client or a hand-rolled call will send, and
 * it should be REFUSED clearly rather than silently doing something else. It
 * goes through the same `transitionOrder` WITHOUT the correction flag, so a
 * backwards or skipped move comes back 409 with the reason — naming a status
 * this way never reverses an order, however earlier that status is.
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

  let body: {
    action?: string;
    status?: OrderStatus;
    to?: OrderStatus;
    reason?: string;
    from?: OrderStatus;
  };
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
  } else if (body.action === "revert") {
    if (!body.to || !KNOWN_STATUSES.includes(body.to)) {
      return NextResponse.json(
        { ok: false, error: "Say which stage to move the order back to." },
        { status: 422 },
      );
    }
    if (!from) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A correction must say what it is correcting — send "from" with the status the order was in.',
        },
        { status: 422 },
      );
    }
    const reason = body.reason?.trim();
    if (reason && reason.length > MAX_REASON) {
      return NextResponse.json(
        { ok: false, error: `Keep the note under ${MAX_REASON} characters.` },
        { status: 422 },
      );
    }
    result = await revertOrder(reference, body.to, from, reason);
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
      {
        ok: false,
        error:
          'Send { "action": "advance" }, { "action": "revert", "to": …, "from": … } or { "action": "cancel", "reason": … }.',
      },
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
