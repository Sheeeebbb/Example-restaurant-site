import { NextResponse } from "next/server";
import { requestMessages } from "@/i18n/server";
import { placeOrder, type PlaceOrderRequest } from "@/lib/order/place-order";
import { saveOrder } from "@/lib/order/order-repository";
import { openRefund, settleRefund } from "@/lib/order/refund";

/**
 * The checkout endpoint.
 *
 * This is the seam a real payment integration slots into. Today it calls
 * `placeOrder`, which recomputes every price from the live menu and charges the
 * mock provider. With Stripe, the same handler would create a PaymentIntent for
 * the amount IT calculated and return the client secret — the shape of what
 * crosses the wire does not change.
 *
 * Note what the request body does NOT contain: no prices, and no card details.
 * Prices are recomputed here because a client-sent total cannot be trusted;
 * card details never arrive because, with a real processor, they go straight
 * from the browser to Stripe and never touch this server at all.
 */
export async function POST(request: Request) {
  /*
   * Every refusal below is shown to the customer verbatim at the checkout, so
   * it is written in their language. The locale comes from the same cookie the
   * pages read — nothing about the order itself depends on it.
   */
  const { t } = await requestMessages();

  let body: PlaceOrderRequest;

  try {
    body = (await request.json()) as PlaceOrderRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: t("errors.unreadableRequest") },
      { status: 400 },
    );
  }

  const result = await placeOrder(body, new Date(), t);

  if (!result.ok) {
    // 422: the request was well-formed but the order cannot be accepted —
    // sold out, below the delivery minimum, a slot that has passed.
    return NextResponse.json(result, { status: 422 });
  }

  /*
   * Persist server-side so the kitchen can see it. Before this existed an order
   * lived only in the customer's browser tab, where no member of staff could
   * ever have reached it.
   *
   * ── The dangerous moment ────────────────────────────────────────────────
   * `placeOrder` has already charged the card. If this write fails — the
   * database is down, the disk is full — the customer has paid and there is no
   * order: nobody will cook it, and nobody will know it was ever meant to
   * exist. That is the single worst outcome this endpoint has, and it is worse
   * than either "no order" or "no charge" on their own.
   *
   * So a failed write gives the money back. The refund goes through the same
   * provider path as a cancellation, which means it is a real request whose
   * real answer is reported — this cannot claim a refund the provider did not
   * confirm, and the customer is told which of the two happened.
   */
  try {
    await saveOrder(result.order);
  } catch (error) {
    const { reference } = result.order.payment;
    console.error(
      `[checkout] PAID BUT NOT SAVED — payment ${reference}, order ${result.order.reference}:`,
      error,
    );

    let refunded = false;
    try {
      const settled = await settleRefund(
        result.order,
        openRefund(result.order, new Date().toISOString()),
      );
      refunded = settled.status === "succeeded";
      console.error(
        `[checkout] refund for ${reference}: ${settled.status}${
          settled.failureMessage ? ` — ${settled.failureMessage}` : ""
        }`,
      );
    } catch (refundError) {
      console.error(`[checkout] refund for ${reference} threw:`, refundError);
    }

    /*
     * 503 and the truth. The payment reference is included because it is the
     * one thing that lets the restaurant find this in the provider's dashboard
     * — it identifies a transaction, not a person, and the customer needs to be
     * able to quote it. Nothing about the failure itself is echoed back.
     */
    return NextResponse.json(
      {
        ok: false,
        error: refunded ? t("errors.paidRefunded") : t("errors.paidNotSaved"),
        paymentReference: reference,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(result, { status: 201 });
}
