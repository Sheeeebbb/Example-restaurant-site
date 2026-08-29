"use client";

import { useTranslations, useLocale } from "next-intl";
import { translateStatus } from "@/i18n/status";
import { FORMATTING, type Locale } from "@/i18n/config";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderTimeline } from "./OrderTimeline";
import { useOrderStore } from "@/lib/order/order-store";
import { deriveStatus } from "@/lib/order/status";
import { FoodImage } from "@/components/menu/FoodImage";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import { customerRefundNotice } from "@/lib/order/refund-copy";
import type { Order, OrderStatus, RefundStatus } from "@/lib/types";

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
export function OrderConfirmation({
  reference,
  photoMap,
  categoryByItemId,
}: {
  reference: string;
  /** Menu image path -> resolved file, or null. Resolved on the server. */
  photoMap: Record<string, string | null>;
  /** Item id -> category, so the fallback glyph matches the dish. */
  categoryByItemId: Record<string, string>;
}) {
  const t = useTranslations("order");
  const ts = useTranslations("order.status");
  const locale = useLocale() as Locale;
  const money = (cents: number) => formatMoney(cents, locale);

  const orders = useOrderStore((state) => state.orders);
  const hasHydrated = useOrderStore((state) => state.hasHydrated);

  const [now, setNow] = useState(() => new Date());
  /** A status the kitchen set by hand, which overrides the simulation. */
  const [staffStatus, setStaffStatus] = useState<OrderStatus | null>(null);
  /*
   * The reason, if the restaurant cancelled.
   *
   * It has to come from the server: the customer's own copy of this order was
   * written when they placed it, hours before anyone decided to cancel it, so
   * the browser cannot possibly know why. This is the only staff-written text
   * the endpoint returns, and it is written for them to read.
   */
  const [cancellation, setCancellation] = useState<{
    reason: string | null;
    at: string | null;
    /**
     * Where the refund got to, as the server reports it.
     *
     * Only ever what the payment provider actually said. The page has no
     * fallback that assumes a refund succeeded, because a page that assumes
     * that is the thing this must not do.
     */
    refund: { status: RefundStatus; amount: number } | null;
  } | null>(null);

  useEffect(() => {
    void useOrderStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Ask the kitchen what it says.
   *
   * The customer's own copy of the order (items, address, receipt) comes from
   * their browser — it is their data and it should not need a round trip. Only
   * the STATUS is fetched, from an endpoint that returns nothing else, so an
   * order reference on its own never unlocks anyone's personal details.
   *
   * Polling at 20s because a kitchen screen and a customer's phone are rarely
   * in sync; a real backend would push this over SSE instead.
   */
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`/api/orders/${reference}/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as {
          status: OrderStatus;
          setByStaff: boolean;
          cancellationReason?: string | null;
          cancelledAt?: string | null;
          refund?: { status: RefundStatus; amount: number } | null;
        };
        if (cancelled) return;
        if (body.setByStaff) setStaffStatus(body.status);
        if (body.status === "cancelled") {
          setCancellation({
            reason: body.cancellationReason ?? null,
            at: body.cancelledAt ?? null,
            refund: body.refund ?? null,
          });
        }
      } catch {
        // Offline or the server restarted: keep showing the simulated status
        // rather than blanking a page the customer is watching.
      }
    };

    void check();
    const id = window.setInterval(() => void check(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reference]);

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

  const status = staffStatus ?? deriveStatus(order, now);
  const isCancelled = status === "cancelled";
  const refundNotice = customerRefundNotice(cancellation?.refund ?? undefined);
  const isDelivery = order.fulfillment.type === "delivery";
  const readyAt = new Date(order.estimatedReadyAt);

  const timeFormat = new Intl.DateTimeFormat(FORMATTING[locale].dateTime, {
    hour: "numeric",
    minute: "2-digit",
  });
  const dayFormat = new Intl.DateTimeFormat(FORMATTING[locale].dateTime, {
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
      {isCancelled ? (
        /*
          A cancelled order gets its own head of the page rather than the
          confirmation with a warning bolted on: the green tick and "Order
          Confirmed!" are now untrue, and so is the estimated delivery time, so
          none of it is drawn. Warning tones, not danger ones — the restaurant
          has let this customer down and the page should read as an apology, not
          an error screen.
        */
        <div className="rounded-card border border-warning bg-warning-soft p-6 sm:p-10">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-on-warning">
                <path
                  d="M7 7l10 10M17 7L7 17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Order Cancelled
              </h1>
              <p className="mt-2 text-lg leading-relaxed text-ink-muted">
                We&rsquo;re sorry — your order has been cancelled by the
                restaurant.
              </p>
            </div>
          </div>

          {/* The staff member's own words, quoted. Shown only when there are
              some: an empty "Reason:" heading is worse than no heading. */}
          {cancellation?.reason && (
            <div className="mt-6 rounded-control border border-warning/40 bg-surface p-4">
              <p className="text-sm font-semibold text-ink">{t("reason")}</p>
              <p className="mt-1 leading-relaxed text-ink-muted">
                {cancellation.reason}
              </p>
            </div>
          )}

          {/*
            Where the money is.
            
            The second question anyone asks after "why", so it is answered in
            the same breath rather than left to a phone call — and answered with
            the state the payment provider actually reported. "Initiated" and
            "completed" are different sentences here, and a refund that failed
            says so plainly instead of borrowing either of them.
          */}
          <div
            className={`mt-4 rounded-control border p-4 ${
              refundNotice.tone === "warn"
                ? "border-danger/40 bg-danger-soft"
                : refundNotice.tone === "good"
                  ? "border-herb/40 bg-herb-soft"
                  : "border-warning/40 bg-surface"
            }`}
          >
            <p className="text-sm font-semibold text-ink">{t("refund")}</p>
            <p className="mt-1 font-medium text-ink">{refundNotice.headline}</p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              {refundNotice.detail}
            </p>
          </div>

          <dl className="mt-8 grid gap-6 border-t border-warning/30 pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-muted">{t("orderNumber")}</dt>
              <dd className="mt-1 font-display text-2xl font-bold tracking-wide text-ink">
                {order.reference}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Cancelled</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-ink">
                {cancellation?.at ? timeFormat.format(new Date(cancellation.at)) : "—"}
              </dd>
              <dd className="text-sm text-ink-muted">
                {cancellation?.at ? dayFormat.format(new Date(cancellation.at)) : ""}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">
                {cancellation?.refund?.status === "notRequired"
                  ? "Charged"
                  : "Refund"}
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-ink">
                {money(
                  cancellation?.refund?.amount ?? order.totals.total,
                )}
              </dd>
              <dd className="text-sm text-ink-muted">
                {order.payment.provider === "mock"
                  ? t("testPayment")
                  : ""}
              </dd>
            </div>
          </dl>

          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            Any questions about this order, call us on{" "}
            <a
              className="font-medium text-ink underline underline-offset-4"
              href={`tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`}
            >
              {RESTAURANT.contact.phone}
            </a>{" "}
            and quote {order.reference}.
          </p>
        </div>
      ) : (
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
              <dt className="text-sm text-ink-muted">{t("orderNumber")}</dt>
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
                {money(order.totals.total)}
              </dd>
              <dd className="text-sm text-ink-muted">
                {order.payment.provider === "mock" ? "Test payment — nothing charged" : ""}
              </dd>
            </div>
          </dl>
        </div>
      )}

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
            {translateStatus(ts, status, order.fulfillment.type)}
          </p>

          {isCancelled ? (
            /*
              No timeline. A cancelled order did not travel any of those
              stages, and drawing a progress track with nothing lit — or worse,
              with "Preparing" still glowing from before — is exactly the
              contradiction the customer must never be shown.
            */
            <div className="mt-6 rounded-card border border-warning bg-warning-soft p-6">
              <p className="font-display text-lg font-semibold text-ink">
                This order isn&rsquo;t coming
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                It was cancelled by the restaurant
                {cancellation?.at ? ` at ${timeFormat.format(new Date(cancellation.at))}` : ""}
                , so nothing is being prepared and nothing is on its way.
              </p>
              {/* The reason itself is at the top of the page, where the
                  customer reads it first. Repeating it here would say the same
                  sentence twice on one screen. */}
              <Link
                href="/menu"
                className="mt-5 inline-flex min-h-11 items-center rounded-control bg-ember px-5 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
              >
                Order something else
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-card border border-line bg-surface p-6">
                <OrderTimeline
                  status={status}
                  fulfillmentType={order.fulfillment.type}
                />
              </div>

              <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
                Status is simulated for this demonstration and advances on the
                estimated timings above, until the kitchen sets it by hand — from
                then on you see exactly what they set.
              </p>
            </>
          )}
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
                <li key={line.lineId} className="flex items-start gap-3 py-3">
                  {/*
                    Decorative: the dish name sits immediately beside it. The
                    thumbnail is here so the food the customer chose is still
                    visible at the end of the journey — the confirmation was
                    text-only, which made the last screen the only one in the
                    flow with no imagery at all.
                  */}
                  <span
                    aria-hidden="true"
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken"
                  >
                    <FoodImage
                      src={photoMap[line.imageSrc] ?? null}
                      alt=""
                      categoryId={categoryByItemId[line.menuItemId] ?? "cat-burgers"}
                      sizes="48px"
                      glyphClassName="h-5 w-5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
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
                    {money(line.unitPrice * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="tabular-nums text-ink">
                  {money(order.totals.subtotal)}
                </dd>
              </div>
              {order.totals.discount > 0 && (
                <div className="flex justify-between gap-4 text-herb">
                  <dt>Discount ({order.promotionCode})</dt>
                  <dd className="tabular-nums">
                    −{money(order.totals.discount)}
                  </dd>
                </div>
              )}
              {isDelivery && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Delivery</dt>
                  <dd className="tabular-nums text-ink">
                    {order.totals.deliveryFee === 0
                      ? "Free"
                      : money(order.totals.deliveryFee)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-line pt-2 text-base">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {money(order.totals.total)}
                </dd>
              </div>
              <p className="text-xs text-ink-subtle">
                Includes {money(order.totals.tax)} VAT at{" "}
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
