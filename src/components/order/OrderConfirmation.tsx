"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderTimeline } from "./OrderTimeline";
import { useOrderStore } from "@/lib/order/order-store";
import { deriveStatus, statusLabel } from "@/lib/order/status";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { Order } from "@/lib/types";

/**
 * Order confirmation and tracking.
 *
 * The order is read from the store by the reference in the URL, so refreshing
 * re-reads it rather than losing it — the page has no state of its own that a
 * reload could destroy.
 *
 * Status is derived from the clock on a one-minute tick. Because it is computed
 * from `createdAt` rather than counted up from mount, a refresh lands on the
 * same stage the customer was already looking at.
 */
export function OrderConfirmation({ reference }: { reference: string }) {
  const orders = useOrderStore((state) => state.orders);
  const hasHydrated = useOrderStore((state) => state.hasHydrated);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void useOrderStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!hasHydrated) {
    return (
      <Container className="py-20">
        <p role="status" className="text-ink-muted">
          Finding your order…
        </p>
      </Container>
    );
  }

  const order: Order | undefined = orders[reference];

  if (!order) {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">
            We can&rsquo;t find that order
          </h1>
          <p className="mt-4 leading-relaxed text-ink-muted">
            Order <span className="font-medium text-ink">{reference}</span>{" "}
            isn&rsquo;t in this browser. Orders in this demonstration are kept
            for the current tab only — closing it clears them.
          </p>
          <Link
            href="/menu"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-control bg-ember px-6 font-semibold text-on-ember"
          >
            Browse Menu
          </Link>
        </div>
      </Container>
    );
  }

  const status = deriveStatus(order, now);
  const isDelivery = order.fulfillment.type === "delivery";
  const readyAt = new Date(order.estimatedReadyAt);

  const timeFormat = new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
    hour: "numeric",
    minute: "2-digit",
  });
  const dayFormat = new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const sameDay = readyAt.toDateString() === new Date(order.createdAt).toDateString();
  const minutesAway = Math.max(
    0,
    Math.round((readyAt.getTime() - now.getTime()) / 60_000),
  );

  return (
    <Container className="py-10 sm:py-14">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="rounded-card border border-herb bg-herb-soft p-6 sm:p-10">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-herb"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-on-herb">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Order Confirmed!
            </h1>
            <p className="mt-2 text-lg text-ink-muted">
              Thanks {order.customer.name.split(" ")[0]} — we&rsquo;ve sent a
              receipt to {order.customer.email}.
            </p>
          </div>
        </div>

        <dl className="mt-8 grid gap-6 border-t border-herb/30 pt-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">Order number</dt>
            <dd className="mt-1 font-display text-2xl font-bold tracking-wide text-ink">
              {order.reference}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">
              {isDelivery ? "Estimated delivery" : "Ready for pickup"}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold text-ink">
              {timeFormat.format(readyAt)}
            </dd>
            <dd className="text-sm text-ink-muted">
              {sameDay ? `about ${minutesAway} minutes away` : dayFormat.format(readyAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Total paid</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-ink">
              {formatMoney(order.totals.total)}
            </dd>
            <dd className="text-sm text-ink-muted">
              {order.payment.provider === "mock" ? "Test payment — nothing charged" : ""}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        {/* ── Tracking ───────────────────────────────────────────────────── */}
        <section aria-labelledby="tracking-heading">
          <h2
            id="tracking-heading"
            className="font-display text-xl font-semibold text-ink"
          >
            Order status
          </h2>
          <p role="status" className="mt-1 text-sm text-ink-muted">
            {statusLabel(status, order.fulfillment.type)}
          </p>

          <div className="mt-6 rounded-card border border-line bg-surface p-6">
            <OrderTimeline status={status} fulfillmentType={order.fulfillment.type} />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
            Status is simulated for this demonstration and advances on the
            estimated timings above. A real kitchen would set it by hand.
          </p>
        </section>

        {/* ── Order details ──────────────────────────────────────────────── */}
        <section aria-labelledby="details-heading" className="space-y-6">
          <h2 id="details-heading" className="sr-only">
            Order details
          </h2>

          <div className="rounded-card border border-line bg-surface p-6">
            <h3 className="font-display text-lg font-semibold text-ink">
              {isDelivery ? "Delivering to" : "Collect from"}
            </h3>
            {isDelivery && order.fulfillment.address ? (
              <address className="mt-3 text-sm not-italic leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">{order.customer.name}</span>
                <br />
                {order.fulfillment.address.street}{" "}
                {order.fulfillment.address.houseNumber}
                <br />
                {order.fulfillment.address.postalCode}{" "}
                {order.fulfillment.address.city}
                {order.fulfillment.address.deliveryInstructions && (
                  <>
                    <br />
                    <span className="italic">
                      {order.fulfillment.address.deliveryInstructions}
                    </span>
                  </>
                )}
              </address>
            ) : (
              <address className="mt-3 text-sm not-italic leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">{RESTAURANT.name}</span>
                <br />
                {RESTAURANT.address.line1}
                <br />
                {RESTAURANT.address.postalCode} {RESTAURANT.address.city}
                <br />
                <a
                  className="underline underline-offset-4 hover:text-ink"
                  href={`tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`}
                >
                  {RESTAURANT.contact.phone}
                </a>
              </address>
            )}
          </div>

          <div className="rounded-card border border-line bg-surface p-6">
            <h3 className="font-display text-lg font-semibold text-ink">
              What you ordered
            </h3>
            <ul className="mt-4 divide-y divide-line">
              {order.lines.map((line) => (
                <li key={line.lineId} className="flex justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {line.quantity} × {line.name}
                    </p>
                    {line.selections.length > 0 && (
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                        {line.selections.map((s) => s.name).join(" · ")}
                      </p>
                    )}
                    {line.notes && (
                      <p className="mt-0.5 text-sm italic text-ink-muted">
                        &ldquo;{line.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 tabular-nums text-ink">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="tabular-nums text-ink">
                  {formatMoney(order.totals.subtotal)}
                </dd>
              </div>
              {order.totals.discount > 0 && (
                <div className="flex justify-between gap-4 text-herb">
                  <dt>Discount ({order.promotionCode})</dt>
                  <dd className="tabular-nums">
                    −{formatMoney(order.totals.discount)}
                  </dd>
                </div>
              )}
              {isDelivery && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Delivery</dt>
                  <dd className="tabular-nums text-ink">
                    {order.totals.deliveryFee === 0
                      ? "Free"
                      : formatMoney(order.totals.deliveryFee)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-line pt-2 text-base">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {formatMoney(order.totals.total)}
                </dd>
              </div>
              <p className="text-xs text-ink-subtle">
                Includes {formatMoney(order.totals.tax)} VAT at{" "}
                {RESTAURANT.fees.taxRatePercent}%. Payment reference{" "}
                {order.payment.reference}.
              </p>
            </dl>
          </div>

          <Link
            href="/menu"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-line-strong bg-surface px-6 font-medium text-ink transition-colors hover:bg-surface-sunken"
          >
            Order something else
          </Link>
        </section>
      </div>
    </Container>
  );
}
