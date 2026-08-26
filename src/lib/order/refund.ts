import type { IsoDateTime, Order, RefundResult } from "../types";
import { getPaymentProvider } from "../payments";
import { RESTAURANT } from "../config/restaurant";

/**
 * Refunding a cancelled order.
 *
 * SERVER ONLY. Split into two steps because a refund is two things happening
 * at different times, and conflating them is how an application ends up
 * claiming money is on its way when nobody has been asked yet:
 *
 *   openRefund     what we know the instant staff cancel — that a refund is
 *                  owed, for how much, and that it has been asked for. Written
 *                  with the cancellation itself.
 *   settleRefund   what the payment provider says. Only this can produce
 *                  `succeeded`, and it says `failed` when the provider refuses
 *                  or cannot be reached.
 *
 * Nothing here decides an order's status. A refund that fails does not un-cancel
 * anything: the customer's order is still cancelled, and the money is now a
 * problem for staff to chase, which is precisely what the failed record is for.
 */

/**
 * Whether there is anything to send back.
 *
 * An order can only exist if its payment succeeded (see `placeOrder`), so in
 * practice this is always true — but "in practice" is not a guarantee, and an
 * order restored from an old store or edited by hand could carry anything.
 * Asking a provider to refund a charge it never took is worse than noticing.
 */
function amountToRefund(order: Order): number {
  if (order.payment.status !== "succeeded") return 0;
  return Math.max(0, order.payment.amount);
}

/**
 * The refund record as it stands before the provider has been asked.
 *
 * `pending` is not optimism, it is the literal state: a refund has been
 * initiated and nobody has confirmed it. If the process dies between here and
 * the provider's answer, this is what the order is left showing — which is the
 * truth, and puts it in front of staff rather than silently losing it.
 */
export function openRefund(order: Order, at: IsoDateTime): RefundResult {
  const amount = amountToRefund(order);

  if (amount === 0) {
    return {
      provider: order.payment.provider,
      status: "notRequired",
      amount: 0,
      initiatedAt: at,
    };
  }

  return {
    provider: order.payment.provider,
    status: "pending",
    amount,
    initiatedAt: at,
  };
}

/**
 * Asks the payment provider to send the money back.
 *
 * Never throws, and never invents an outcome. Everything it can go wrong by —
 * a provider that refuses, a provider that isn't reachable, a payment taken by
 * some other provider entirely — comes back as a `failed` refund carrying the
 * reason, because the order has to record what happened either way.
 */
export async function settleRefund(
  order: Order,
  opened: RefundResult,
): Promise<RefundResult> {
  if (opened.status !== "pending") return opened;

  const failed = (failureMessage: string): RefundResult => ({
    ...opened,
    status: "failed",
    settledAt: new Date().toISOString(),
    failureMessage,
  });

  const provider = getPaymentProvider();

  /*
   * Only the provider that took the money can give it back. A mismatch means
   * the order was paid through something this deployment is no longer
   * configured for — refunding it "successfully" through the current provider
   * would move the wrong money, or more likely none at all.
   */
  if (provider.id !== order.payment.provider) {
    return failed(
      `This order was paid through "${order.payment.provider}", but the active payment provider is "${provider.id}". Refund it from the ${order.payment.provider} dashboard.`,
    );
  }

  try {
    const result = await provider.refundPayment({
      paymentReference: order.payment.reference,
      amount: opened.amount,
      currency: RESTAURANT.currency,
      orderReference: order.reference,
      reason: order.cancellationReason,
    });

    // The provider owns status, id and settlement time. `initiatedAt` stays
    // ours: it is when the restaurant decided, not when the request landed.
    return { ...result, initiatedAt: opened.initiatedAt };
  } catch (error) {
    return failed(
      `The payment provider could not be reached: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}
