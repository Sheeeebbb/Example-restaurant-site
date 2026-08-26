import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cancelOrder, advanceOrder, getOrder, saveOrder } from "./order-repository";
import { openRefund } from "./refund";
import { customerRefundNotice, staffRefundNotice } from "./refund-copy";
import { MockPaymentProvider } from "../payments/mock";
import { resetStore } from "../server/store";
import type { Order, OrderStatus, RefundStatus } from "../types";

/**
 * Cancelling an order sends the money back.
 *
 * The rule under test is narrower than "a refund happens": it is that the
 * application never says a refund succeeded unless the payment provider said
 * so. So the failure and pending paths get as much attention as the happy one,
 * and the customer-facing wording is asserted, not just the stored field.
 */

const NOW = new Date(2026, 7, 22, 19, 0);

const order = (over: Partial<Order> = {}): Order => ({
  id: `ord_${Math.random()}`,
  reference: `UT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  createdAt: NOW.toISOString(),
  customer: { name: "Marta K", email: "m@example.com", phone: "+493055501420" },
  fulfillment: { type: "delivery", timing: "asap" },
  lines: [],
  totals: { subtotal: 2000, discount: 0, deliveryFee: 199, tax: 350, total: 2199 },
  status: "confirmed",
  history: [{ status: "confirmed", at: NOW.toISOString(), by: "system" }],
  payment: {
    provider: "mock",
    status: "succeeded",
    reference: "mock_abc123",
    amount: 2199,
    processedAt: NOW.toISOString(),
  },
  estimatedReadyAt: new Date(NOW.getTime() + 40 * 60_000).toISOString(),
  ...over,
});

/** Every stage cancellation is currently permitted from. */
const CANCELLABLE: OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "outForDelivery",
];

beforeEach(() => resetStore());
afterEach(() => {
  delete process.env.MOCK_REFUND_OUTCOME;
});

describe("cancelling initiates a refund", () => {
  it("does it from every stage a cancellation is allowed from", async () => {
    for (const from of CANCELLABLE) {
      const reference = `UT-R${from.slice(0, 3).toUpperCase()}`;
      await saveOrder(order({ reference, status: from }));

      const result = await cancelOrder(reference, "The fryer has broken.");
      expect(result.ok, from).toBe(true);
      if (!result.ok) continue;

      // All four things the cancellation is meant to do, at every stage.
      expect(result.order.status, from).toBe("cancelled");
      expect(result.order.cancellationReason, from).toBe("The fryer has broken.");
      expect(result.order.refund?.status, from).toBe("succeeded");
      expect(result.order.refund?.amount, from).toBe(2199);
    }
  });

  it("refunds what was actually charged, not what the order says it costs", async () => {
    // A partial capture, a price corrected after the fact: the payment is the
    // record of what left the customer's account.
    await saveOrder(
      order({
        reference: "UT-AMOUNT",
        payment: {
          provider: "mock",
          status: "succeeded",
          reference: "mock_partial",
          amount: 1500,
          processedAt: NOW.toISOString(),
        },
      }),
    );

    const result = await cancelOrder("UT-AMOUNT", "Out of stock.");
    expect(result.ok && result.order.refund?.amount).toBe(1500);
  });

  it("keeps the provider's own refund identifier for reconciliation", async () => {
    await saveOrder(order({ reference: "UT-REF" }));
    const result = await cancelOrder("UT-REF", "Kitchen closing early.");

    expect(result.ok && result.order.refund?.reference).toMatch(/^mock_re_/);
    expect(result.ok && result.order.refund?.provider).toBe("mock");
    expect(result.ok && result.order.refund?.settledAt).toBeTruthy();
  });

  it("persists the refund, not just returns it", async () => {
    await saveOrder(order({ reference: "UT-SAVED" }));
    await cancelOrder("UT-SAVED", "Double booking.");

    const stored = await getOrder("UT-SAVED");
    expect(stored?.refund?.status).toBe("succeeded");
    expect(stored?.cancelledAt).toBeTruthy();
  });

  it("happens on no other transition — only cancellation refunds", async () => {
    await saveOrder(order({ reference: "UT-NOREF" }));
    for (let step = 0; step < 4; step += 1) {
      const result = await advanceOrder("UT-NOREF");
      expect(result.ok && result.order.refund).toBeUndefined();
    }
  });
});

describe("when the refund fails", () => {
  it("records the failure and leaves the order cancelled", async () => {
    process.env.MOCK_REFUND_OUTCOME = "failed";
    await saveOrder(order({ reference: "UT-FAIL", status: "preparing" }));

    const result = await cancelOrder("UT-FAIL", "The delivery driver is ill.");

    // The cancellation stands. A payment provider having a bad afternoon does
    // not leave the kitchen cooking food nobody is coming for.
    expect(result.ok).toBe(true);
    expect(result.ok && result.order.status).toBe("cancelled");
    expect(result.ok && result.order.cancellationReason).toBe(
      "The delivery driver is ill.",
    );

    const refund = result.ok ? result.order.refund : undefined;
    expect(refund?.status).toBe("failed");
    expect(refund?.failureMessage).toBeTruthy();
    expect(refund?.reference).toBeUndefined();
  });

  it("tells staff a person has to act, and says what went wrong", async () => {
    process.env.MOCK_REFUND_OUTCOME = "failed";
    await saveOrder(order({ reference: "UT-WARN" }));
    const result = await cancelOrder("UT-WARN", "Sold out.");

    const notice = staffRefundNotice(result.ok ? result.order.refund : undefined);
    expect(notice.needsAttention).toBe(true);
    expect(notice.tone).toBe("warn");
    expect(notice.headline).toMatch(/manual action/i);
    expect(notice.detail.length).toBeGreaterThan(10);
  });

  it("never tells the customer their money is on its way", async () => {
    process.env.MOCK_REFUND_OUTCOME = "failed";
    await saveOrder(order({ reference: "UT-HONEST" }));
    const result = await cancelOrder("UT-HONEST", "Sold out.");

    const notice = customerRefundNotice(result.ok ? result.order.refund : undefined);
    expect(notice.headline).not.toMatch(/completed|initiated|on its way/i);
    expect(notice.headline).toMatch(/couldn't process/i);
  });

  it("fails rather than refunds when another provider took the money", async () => {
    await saveOrder(
      order({
        reference: "UT-OTHER",
        payment: {
          provider: "stripe",
          status: "succeeded",
          reference: "pi_3Abc123",
          amount: 2199,
          processedAt: NOW.toISOString(),
        },
      }),
    );

    const result = await cancelOrder("UT-OTHER", "Restaurant closed.");
    const refund = result.ok ? result.order.refund : undefined;

    expect(refund?.status).toBe("failed");
    expect(refund?.failureMessage).toMatch(/stripe/i);
    expect(staffRefundNotice(refund).needsAttention).toBe(true);
  });
});

describe("when the refund is accepted but not yet settled", () => {
  it("stays pending, with no settlement time invented for it", async () => {
    process.env.MOCK_REFUND_OUTCOME = "pending";
    await saveOrder(order({ reference: "UT-SLOW" }));

    const result = await cancelOrder("UT-SLOW", "Kitchen flooded.");
    const refund = result.ok ? result.order.refund : undefined;

    expect(refund?.status).toBe("pending");
    expect(refund?.settledAt).toBeUndefined();
    expect(refund?.initiatedAt).toBeTruthy();
  });

  it("tells the customer it has been initiated, not completed", async () => {
    const notice = customerRefundNotice({ status: "pending" });
    expect(notice.headline).toMatch(/initiated/i);
    expect(notice.headline).not.toMatch(/completed/i);
  });

  it("does not ask staff to do anything about it", async () => {
    expect(staffRefundNotice({
      provider: "mock",
      status: "pending",
      amount: 2199,
      initiatedAt: NOW.toISOString(),
    }).needsAttention).toBe(false);
  });
});

describe("when there was never a payment to send back", () => {
  it("records that nothing is owed rather than claiming a refund", () => {
    const unpaid = order({
      payment: {
        provider: "mock",
        status: "failed",
        reference: "mock_failed_1",
        amount: 2199,
        processedAt: NOW.toISOString(),
      },
    });

    const opened = openRefund(unpaid, NOW.toISOString());
    expect(opened.status).toBe("notRequired");
    expect(opened.amount).toBe(0);
  });

  it("says so to the customer without mentioning a refund arriving", () => {
    const notice = customerRefundNotice({ status: "notRequired" });
    expect(notice.headline).toMatch(/nothing was charged/i);
    expect(notice.detail).not.toMatch(/on its way|working days/i);
  });
});

describe("the mock provider's own refusals", () => {
  const provider = new MockPaymentProvider(0);
  const request = {
    paymentReference: "mock_abc123",
    amount: 2199,
    currency: "EUR",
    orderReference: "UT-AAAAA",
  };

  it("refuses a payment it has no record of", async () => {
    const result = await provider.refundPayment({
      ...request,
      paymentReference: "pi_3Abc123",
    });
    expect(result.status).toBe("failed");
    expect(result.failureMessage).toMatch(/no payment matching/i);
  });

  it("refuses to refund a charge that itself failed", async () => {
    const result = await provider.refundPayment({
      ...request,
      paymentReference: "mock_failed_9",
    });
    expect(result.status).toBe("failed");
  });

  it("refuses a non-positive amount", async () => {
    for (const amount of [0, -100]) {
      const result = await provider.refundPayment({ ...request, amount });
      expect(result.status, `${amount}`).toBe("failed");
      expect(result.failureMessage, `${amount}`).toMatch(/greater than zero/i);
    }
  });

  it("never throws for an ordinary refusal — the caller has to record it", async () => {
    await expect(
      provider.refundPayment({ ...request, paymentReference: "nonsense" }),
    ).resolves.toMatchObject({ status: "failed" });
  });
});

describe("the wording can never overstate the state", () => {
  const ALL: RefundStatus[] = ["pending", "succeeded", "failed", "notRequired"];

  it("only says 'completed' for a refund the provider confirmed", () => {
    for (const status of ALL) {
      const notice = customerRefundNotice({ status });
      const claimsDone = /completed/i.test(notice.headline);
      expect(claimsDone, status).toBe(status === "succeeded");
    }
  });

  it("always gives the customer a headline and something to do with it", () => {
    for (const status of [...ALL, undefined]) {
      const notice = customerRefundNotice(status ? { status } : undefined);
      expect(notice.headline.length, String(status)).toBeGreaterThan(10);
      expect(notice.detail.length, String(status)).toBeGreaterThan(10);
    }
  });

  it("flags exactly the two states a person has to chase", () => {
    // A missing record is not "nothing owed" — it is unknown, and unknown gets
    // a human's attention.
    expect(staffRefundNotice(undefined).needsAttention).toBe(true);
    for (const status of ALL) {
      const notice = staffRefundNotice({
        provider: "mock",
        status,
        amount: 2199,
        initiatedAt: NOW.toISOString(),
      });
      expect(notice.needsAttention, status).toBe(status === "failed");
    }
  });
});
