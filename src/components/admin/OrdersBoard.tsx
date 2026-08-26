"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrderDetail } from "./OrderDetail";
import { StatusBadge } from "./StatusBadge";
import { deriveStatus, statusLabel, timelineFor } from "@/lib/order/status";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { Order, OrderStatus } from "@/lib/types";

/**
 * The order queue.
 *
 * A list on the left, the selected order on the right; on narrow screens the
 * detail replaces the list, because a kitchen tablet has no room for both.
 * The selected order lives in the URL (`?order=UT-…`) so a specific order can
 * be linked to from the dashboard and survives a refresh.
 *
 * Polls every 15 seconds. A kitchen screen sits untouched for long stretches,
 * so new orders have to arrive on their own; with a real backend this becomes
 * a server-sent event stream and the polling goes away.
 */
const POLL_MS = 15_000;

type Filter = "active" | "all" | OrderStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "confirmed", label: "New" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export function OrdersBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("order");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  /**
   * Counts status changes made from this screen.
   *
   * A poll started before a status change can resolve after it, carrying the
   * pre-change data and silently reverting what staff just did on screen. The
   * counter lets a response check whether it is still current: if a change
   * landed while it was in flight, its payload is stale and gets dropped.
   * Fifteen seconds makes this rare, not impossible — and "rare" is how a
   * kitchen ends up not trusting the board.
   */
  const mutations = useRef(0);

  const load = useCallback(async () => {
    const startedAt = mutations.current;
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      const body = (await response.json()) as { orders: Order[] };
      if (mutations.current !== startedAt) return; // superseded
      setOrders(body.orders);
      setError(null);
    } catch {
      setError("Couldn't reach the order service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The first fetch is scheduled rather than called in the effect body, so it
    // goes through the same path as every subsequent poll. `load` awaits a
    // fetch before it touches state, but calling it directly here reads as a
    // synchronous setState — to React's lint rules and to anyone skimming it.
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  /**
   * Sends one status action and reports back in words.
   *
   * Returns the failure message rather than setting page-level state, so the
   * detail panel can put it next to the button that was pressed — a refusal
   * belongs where the attempt was made, not in a banner at the top of a screen
   * the kitchen may have scrolled past.
   *
   * `from` rides along with every request: this board polls, so a button can be
   * up to fifteen seconds out of date, and the server refuses an instruction
   * that was about a situation which has since moved on. When it does refuse it
   * hands back the order as it really stands, and that is what the board adopts
   * — a stale screen corrects itself instead of arguing.
   */
  const act = async (
    reference: string,
    payload: { action: "advance" } | { action: "cancel"; reason: string },
    from: OrderStatus,
  ): Promise<string | null> => {
    let body: { ok: boolean; order?: Order; error?: string };
    try {
      const response = await fetch(`/api/admin/orders/${reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, from }),
      });
      body = (await response.json()) as typeof body;
    } catch {
      return "Couldn't reach the order service. Check the connection and try again.";
    }

    mutations.current += 1;
    if (body.order) {
      const fresh = body.order;
      setOrders((current) =>
        current.map((order) => (order.reference === fresh.reference ? fresh : order)),
      );
    }

    if (!body.ok) return body.error ?? "That status change didn't save.";

    setError(null);
    // Keeps the dashboard's counters honest when staff navigate back to it.
    router.refresh();
    return null;
  };

  const withStatus = orders.map((order) => ({
    order,
    status: deriveStatus(order),
  }));

  const visible = withStatus.filter(({ status }) => {
    if (filter === "all") return true;
    if (filter === "active") {
      return status !== "completed" && status !== "cancelled";
    }
    return status === filter;
  });

  const selectedOrder = orders.find((order) => order.reference === selected) ?? null;
  /*
   * Derived once and handed to the panel, which also sends it back as `from`.
   * Computing it separately in each place is how a screen ends up drawing a
   * button for one status and submitting another.
   */
  const selectedStatus = selectedOrder ? deriveStatus(selectedOrder) : "confirmed";

  const select = (reference: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (reference) params.set("order", reference);
    else params.delete("order");
    router.replace(`/admin/orders${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };

  const timeFormat = new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Orders
          </h1>
          <p className="mt-1 text-ink-muted">
            {loading ? "Loading…" : `${orders.length} in total`}
            {!loading && " · refreshes automatically"}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`min-h-11 rounded-full px-3 text-sm font-medium transition-colors ${
                filter === option.value
                  ? "bg-ember text-on-ember"
                  : "border border-line-strong bg-surface text-ink-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* ── Queue ────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="queue-heading"
          className={selectedOrder ? "hidden lg:block" : ""}
        >
          <h2 id="queue-heading" className="sr-only">
            Order queue
          </h2>

          {!loading && visible.length === 0 ? (
            <div className="rounded-card border border-line bg-surface p-8 text-center">
              <p className="font-medium text-ink">Nothing here</p>
              <p className="mt-2 text-sm text-ink-muted">
                No orders match this filter.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map(({ order, status }) => (
                <li key={order.reference}>
                  <button
                    type="button"
                    onClick={() => select(order.reference)}
                    aria-current={order.reference === selected ? "true" : undefined}
                    className={`w-full rounded-card border p-4 text-left transition-colors ${
                      order.reference === selected
                        ? "border-ember bg-ember-soft"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display font-semibold text-ink">
                        {order.reference}
                      </span>
                      <StatusBadge
                        status={status}
                        fulfillmentType={order.fulfillment.type}
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-ink-muted">
                      {order.customer.name} ·{" "}
                      {order.fulfillment.type === "delivery" ? "Delivery" : "Pickup"}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-subtle">
                      {timeFormat.format(new Date(order.createdAt))} ·{" "}
                      {formatMoney(order.totals.total)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Detail ───────────────────────────────────────────────────── */}
        <section aria-labelledby="detail-heading">
          <h2 id="detail-heading" className="sr-only">
            Order details
          </h2>
          {selectedOrder ? (
            <OrderDetail
              order={selectedOrder}
              status={selectedStatus}
              onAdvance={() =>
                act(selectedOrder.reference, { action: "advance" }, selectedStatus)
              }
              onCancel={(reason) =>
                act(selectedOrder.reference, { action: "cancel", reason }, selectedStatus)
              }
              onClose={() => select(null)}
            />
          ) : (
            <div className="hidden h-full items-center justify-center rounded-card border border-dashed border-line-strong bg-surface p-10 text-center lg:flex">
              <p className="text-ink-muted">
                {orders.length === 0
                  ? "Orders placed on the customer site appear here."
                  : "Select an order to see its details."}
              </p>
            </div>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-subtle">
        Status set here replaces the simulated progress the customer sees on
        their tracking page. Orders move one step at a time and never backwards:{" "}
        {timelineFor("delivery")
          .map((stage) => statusLabel(stage, "delivery"))
          .join(" → ")}
        {" "}for delivery,{" "}
        {timelineFor("pickup")
          .map((stage) => statusLabel(stage, "pickup"))
          .join(" → ")}
        {" "}for collection. Cancelling is separate, asks for a reason, refunds
        the payment, and is final.
      </p>
    </div>
  );
}
