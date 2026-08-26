import type { PaymentResult, RefundResult, RefundStatus } from "../types";
import type { PaymentProvider, PaymentRequest, RefundRequest } from "./types";

/**
 * Simulated processor for development and demos.
 *
 * It models the shape of a real gateway — latency, an opaque reference, the
 * possibility of failure — so the checkout UI has to handle pending and error
 * states from day one rather than discovering them the week Stripe is wired up.
 *
 * No card details are collected, transmitted, or stored. Nothing here touches
 * real money.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";
  readonly displayName = "Mock payment (no card charged)";
  readonly isMock = true;

  /** Deterministic in tests, realistic in the browser. */
  constructor(latencyMs?: number) {
    this.latencyMs = latencyMs ?? 900;
  }

  private readonly latencyMs: number;

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    const now = new Date().toISOString();

    // A guard rather than a simulated decline: a zero or negative charge means
    // the pricing engine produced something wrong, and that should never
    // silently succeed.
    if (request.amount <= 0) {
      return {
        provider: this.id,
        status: "failed",
        reference: `mock_failed_${Date.now()}`,
        amount: request.amount,
        processedAt: now,
        failureMessage: "Order total must be greater than zero.",
      };
    }

    return {
      provider: this.id,
      status: "succeeded",
      reference: `mock_${Math.random().toString(36).slice(2, 12)}`,
      amount: request.amount,
      processedAt: now,
    };
  }

  /**
   * Sends a (pretend) refund back for a (pretend) charge.
   *
   * The guards are the real ones a gateway applies, not decoration: it refuses
   * to refund a payment it has no record of, and it refuses a non-positive
   * amount. Both are reachable — an order carrying a payment reference from a
   * different provider hits the first — and both are how the failure path gets
   * exercised without anything being faked.
   *
   * `MOCK_REFUND_OUTCOME` forces the answer to `pending` or `failed` so the
   * staff warning and the customer's copy can be seen in a browser rather than
   * only asserted in a test. It is read here, in the mock, and nowhere else: a
   * real provider has no such switch, and no other part of the application may
   * decide what a refund did.
   */
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    const initiatedAt = new Date().toISOString();
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    const refused = (failureMessage: string): RefundResult => ({
      provider: this.id,
      status: "failed",
      amount: request.amount,
      initiatedAt,
      settledAt: new Date().toISOString(),
      failureMessage,
    });

    // Not a payment this provider ever took. A real gateway 404s here, and it
    // is exactly what a mis-migrated or hand-edited order looks like.
    if (
      !request.paymentReference.startsWith("mock_") ||
      request.paymentReference.startsWith("mock_failed_")
    ) {
      return refused(
        `No payment matching ${request.paymentReference} at this provider.`,
      );
    }

    if (request.amount <= 0) {
      return refused("Refund amount must be greater than zero.");
    }

    const forced = simulatedOutcome();
    if (forced === "failed") {
      return refused("Simulated refund failure (MOCK_REFUND_OUTCOME=failed).");
    }

    const reference = `mock_re_${Math.random().toString(36).slice(2, 12)}`;

    // Left unsettled on purpose: some real refund methods take days, and an
    // order sitting at "initiated" is a state the interface has to survive.
    if (forced === "pending") {
      return {
        provider: this.id,
        status: "pending",
        reference,
        amount: request.amount,
        initiatedAt,
      };
    }

    return {
      provider: this.id,
      status: "succeeded",
      reference,
      amount: request.amount,
      initiatedAt,
      settledAt: new Date().toISOString(),
    };
  }
}

/** Demo/test knob. Anything unrecognised means the ordinary happy path. */
function simulatedOutcome(): Extract<
  RefundStatus,
  "succeeded" | "pending" | "failed"
> {
  const value = process.env.MOCK_REFUND_OUTCOME;
  return value === "pending" || value === "failed" ? value : "succeeded";
}
