import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * What happens when the card is charged and the database then refuses the
 * write.
 *
 * The worst outcome this endpoint has: money taken, no order, nobody cooking.
 * It cannot be provoked by turning the database off — `placeOrder` reads the
 * menu first and fails before charging anything, which is the safe failure. So
 * the write itself is made to fail here, which is the only way to exercise the
 * moment between the charge and the record.
 */

const saveOrder = vi.hoisted(() => vi.fn());
const settleRefund = vi.hoisted(() => vi.fn());
const openRefund = vi.hoisted(() => vi.fn(() => ({ status: "pending" })));
const placeOrder = vi.hoisted(() => vi.fn());

vi.mock("@/lib/order/order-repository", () => ({ saveOrder }));
vi.mock("@/lib/order/refund", () => ({ settleRefund, openRefund }));
vi.mock("@/lib/order/place-order", () => ({ placeOrder }));

const { POST } = await import("./route");

const anOrder = {
  reference: "UT-FAIL1",
  payment: { provider: "mock", status: "succeeded", reference: "pay_abc123", amount: 1395 },
};

const post = () =>
  POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: [], fulfillment: {}, draft: {} }),
    }),
  );

afterEach(() => vi.clearAllMocks());

describe("when the order cannot be saved after the card was charged", () => {
  it("never reports success", async () => {
    placeOrder.mockResolvedValue({ ok: true, order: anOrder });
    saveOrder.mockRejectedValue(new Error("connection refused"));
    settleRefund.mockResolvedValue({ status: "succeeded" });

    const response = await post();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it("gives the money back", async () => {
    placeOrder.mockResolvedValue({ ok: true, order: anOrder });
    saveOrder.mockRejectedValue(new Error("connection refused"));
    settleRefund.mockResolvedValue({ status: "succeeded" });

    await post();
    expect(settleRefund).toHaveBeenCalledOnce();
  });

  it("says the money is back only when the provider confirmed it", async () => {
    placeOrder.mockResolvedValue({ ok: true, order: anOrder });
    saveOrder.mockRejectedValue(new Error("connection refused"));
    settleRefund.mockResolvedValue({ status: "succeeded" });

    const body = await (await post()).json();
    expect(body.error).toMatch(/refunded/i);
  });

  it("does NOT claim a refund the provider refused", async () => {
    placeOrder.mockResolvedValue({ ok: true, order: anOrder });
    saveOrder.mockRejectedValue(new Error("connection refused"));
    settleRefund.mockResolvedValue({ status: "failed", failureMessage: "provider down" });

    const body = await (await post()).json();
    expect(body.error).not.toMatch(/refunded/i);
    expect(body.error).toMatch(/contact us/i);
  });

  it("survives the refund attempt itself throwing", async () => {
    placeOrder.mockResolvedValue({ ok: true, order: anOrder });
    saveOrder.mockRejectedValue(new Error("connection refused"));
    settleRefund.mockRejectedValue(new Error("provider unreachable"));

    const response = await post();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/contact us/i);
  });

  it("hands back the payment reference, and nothing else about the failure", async () => {
    placeOrder.mockResolvedValue({ ok: true, order: anOrder });
    saveOrder.mockRejectedValue(new Error("password authentication failed for user \"urbantable\""));
    settleRefund.mockResolvedValue({ status: "succeeded" });

    const body = await (await post()).json();
    // The reference identifies a transaction, so the restaurant can find it.
    expect(body.paymentReference).toBe("pay_abc123");
    // The database's own words never reach the customer.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/password|authentication|urbantable|connection/i);
  });
});
