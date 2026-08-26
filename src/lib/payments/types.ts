import type {
  Cents,
  CustomerDetails,
  PaymentResult,
  RefundResult,
} from "../types";

/**
 * The payment seam.
 *
 * Checkout depends on this interface, never on a concrete processor. Today the
 * only implementation is `MockPaymentProvider`; adding Stripe means writing a
 * second implementation and changing which one `getPaymentProvider()` returns.
 * No checkout code changes.
 *
 * Two rules this interface exists to enforce:
 *
 *   1. NO CARD DATA CROSSES THIS BOUNDARY. There is deliberately no field for a
 *      PAN, CVC, or expiry anywhere in these types. Real card entry belongs in a
 *      Stripe Elements iframe or a hosted checkout page, which keeps the card
 *      details out of our DOM and our servers entirely — and keeps this project
 *      out of PCI scope. Adding a `cardNumber` field here would undo that.
 *
 *   2. THE AMOUNT IS DECIDED SERVER-SIDE. `amount` is passed in by the caller,
 *      and the only correct caller is server code that recomputed it from live
 *      menu data via `calculateTotals`. A client-supplied total must never reach
 *      a provider.
 */

export interface PaymentRequest {
  /** Recomputed server-side. Never taken from the client. */
  amount: Cents;
  currency: string;
  /** Our order reference, for reconciliation against the provider's dashboard. */
  orderReference: string;
  /** Receipt destination and fraud signals only. */
  customer: CustomerDetails;
}

/**
 * What a refund needs, and nothing more.
 *
 * The payment is named by the provider's own identifier — the thing it gave us
 * when it took the money — because that is what every real gateway refunds
 * against: `stripe.refunds.create({ payment_intent })` wants the intent, not
 * our order number. `orderReference` comes along only so the refund is
 * findable from the provider's dashboard.
 */
export interface RefundRequest {
  /** The provider's id for the original charge: `PaymentResult.reference`. */
  paymentReference: string;
  /** How much to send back, in cents. Never more than was taken. */
  amount: Cents;
  currency: string;
  /** Our order reference, for reconciliation. */
  orderReference: string;
  /**
   * Why the order was cancelled, in the staff member's words.
   *
   * Passed for the provider's records where it accepts free text. It is NOT a
   * `reason` enum: Stripe's `reason` field takes one of three fixed values and
   * mapping a restaurant's sentence onto `fraudulent` would be a lie, so an
   * implementation puts this in metadata and picks the enum itself.
   */
  reason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  /** Human-readable, shown on the checkout button and the confirmation page. */
  readonly displayName: string;
  /** True when no money actually moves — the UI shows a clear test-mode notice. */
  readonly isMock: boolean;

  createPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Sends money back for a charge this provider took.
   *
   * Required, not optional, and it is the caller's only route to a refund —
   * there is no path in this application that marks an order refunded without
   * having asked a provider and been told. A provider that cannot refund
   * implements this by returning `status: "failed"` with a message saying so,
   * which is the truth and puts the order in front of staff, rather than
   * leaving the caller to guess from a missing method.
   *
   * Must not throw for an ordinary refusal — a declined or impossible refund is
   * a `failed` result, because the caller has to record it either way.
   */
  refundPayment(request: RefundRequest): Promise<RefundResult>;
}
