"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { DraftHydration } from "@/components/cart/DraftHydration";
import { useCartStore } from "@/lib/cart/store";
import { useCartSummary } from "@/lib/cart/selectors";
import { useOrderDraftStore } from "@/lib/order/draft-store";
import { isDraftValid, toAddress, toCustomerDetails } from "@/lib/order/validation";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";

/**
 * Order review — the last screen before payment.
 *
 * Payment itself is the next stage, and this page says so rather than showing a
 * card form that does nothing. Everything above that line is real: these are the
 * actual cart lines, the actual computed totals, and the actual details the
 * customer entered.
 *
 * It re-checks the configuration on arrival instead of trusting that the cart
 * page validated it — someone can reach this URL directly, or leave a tab open
 * while their basket changes in another.
 */
export function CheckoutReview() {
  const router = useRouter();

  const lines = useCartStore((state) => state.lines);
  const cartHydrated = useCartStore((state) => state.hasHydrated);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const timing = useCartStore((state) => state.timing);
  const scheduledFor = useCartStore((state) => state.scheduledFor);

  const draft = useOrderDraftStore((state) => state.draft);
  const draftHydrated = useOrderDraftStore((state) => state.hasHydrated);
  const summary = useCartSummary();

  const ready = cartHydrated && draftHydrated;
  const configured = ready && lines.length > 0 && isDraftValid(draft, fulfillmentType);

  useEffect(() => {
    if (ready && !configured) router.replace("/cart");
  }, [ready, configured, router]);

  if (!ready || !configured) {
    return (
      <>
        <DraftHydration />
        <Container className="py-20">
          <p role="status" className="text-ink-muted">
            Checking your order…
          </p>
        </Container>
      </>
    );
  }

  const customer = toCustomerDetails(draft);
  const address = fulfillmentType === "delivery" ? toAddress(draft) : null;

  const when =
    timing === "scheduled" && scheduledFor
      ? new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(scheduledFor))
      : "As soon as possible";

  return (
    <>
      <DraftHydration />
      <Container className="py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Review your order
        </h1>
        <p className="mt-2 text-ink-muted">
          Everything below is confirmed.{" "}
          <Link href="/cart" className="underline underline-offset-4 hover:text-ink">
            Go back to change it
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div className="space-y-8">
            <section
              aria-labelledby="review-items"
              className="rounded-card border border-line bg-surface p-6"
            >
              <h2 id="review-items" className="font-display text-xl font-semibold text-ink">
                {summary.itemCount} {summary.itemCount === 1 ? "item" : "items"}
              </h2>
              <ul className="mt-4 divide-y divide-line">
                {lines.map((line) => (
                  <li key={line.lineId} className="flex justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {line.quantity} × {line.name}
                      </p>
                      {line.selections.length > 0 && (
                        <p className="mt-0.5 text-sm text-ink-muted">
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
            </section>

            <section
              aria-labelledby="review-details"
              className="rounded-card border border-line bg-surface p-6"
            >
              <h2 id="review-details" className="font-display text-xl font-semibold text-ink">
                {fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink-subtle">When</dt>
                  <dd className="mt-0.5 text-ink">{when}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Contact</dt>
                  <dd className="mt-0.5 text-ink">
                    {customer.name}
                    <br />
                    {customer.phone}
                    <br />
                    {customer.email}
                  </dd>
                </div>
                {address ? (
                  <div>
                    <dt className="text-ink-subtle">Address</dt>
                    <dd className="mt-0.5 text-ink">
                      {address.street} {address.houseNumber}
                      <br />
                      {address.postalCode} {address.city}
                      {address.deliveryInstructions && (
                        <>
                          <br />
                          <span className="text-ink-muted">
                            {address.deliveryInstructions}
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-ink-subtle">Collect from</dt>
                    <dd className="mt-0.5 text-ink">
                      {RESTAURANT.address.line1}
                      <br />
                      {RESTAURANT.address.postalCode} {RESTAURANT.address.city}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
            <div className="rounded-card border border-line bg-surface p-6">
              <h2 className="font-display text-xl font-semibold text-ink">
                Order summary
              </h2>
              <div className="mt-5">
                <OrderSummary summary={summary} fulfillmentType={fulfillmentType} />
              </div>

              {/*
                No card fields, no disabled "Pay" button pretending to be one
                step away. Payment is the next stage of the build, and saying so
                is more honest than a form that would silently do nothing.
              */}
              <div className="mt-6 rounded-control border border-line bg-surface-sunken p-4">
                <p className="text-sm font-medium text-ink">Payment comes next</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Card payment is the next stage of this build. No payment is
                  taken and no card details are collected anywhere in this
                  project.
                </p>
              </div>

              <Link
                href="/cart"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-control border border-line-strong bg-surface px-6 text-base font-medium text-ink transition-colors hover:bg-surface-sunken"
              >
                Back to cart
              </Link>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
