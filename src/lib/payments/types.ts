import type { Cents, CustomerDetails, PaymentResult } from "../types";

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

export interface PaymentProvider {
  readonly id: string;
  /** Human-readable, shown on the checkout button and the confirmation page. */
  readonly displayName: string;
  /** True when no money actually moves — the UI shows a clear test-mode notice. */
  readonly isMock: boolean;

  createPayment(request: PaymentRequest): Promise<PaymentResult>;
}
