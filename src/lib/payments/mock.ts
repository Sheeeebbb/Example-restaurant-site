import type { PaymentResult } from "../types";
import type { PaymentProvider, PaymentRequest } from "./types";

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
  constructor(private readonly latencyMs = 900) {}

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
}
