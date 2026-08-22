import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, PaymentRequest } from "./types";
export { MockPaymentProvider } from "./mock";

/**
 * Chooses the active processor.
 *
 * When Stripe lands, this becomes:
 *
 *   if (process.env.STRIPE_SECRET_KEY) return new StripePaymentProvider(...)
 *   return new MockPaymentProvider()
 *
 * Read the secret key here and nowhere else, and only from server code — this
 * module must never be imported into a client component.
 */
export function getPaymentProvider(): PaymentProvider {
  // The mock's simulated latency exists to keep the UI honest about pending
  // states. It has no value in tests, where it only makes the suite slow, so
  // it is dropped there.
  const latency = process.env.NODE_ENV === "test" ? 0 : undefined;
  return new MockPaymentProvider(latency);
}
