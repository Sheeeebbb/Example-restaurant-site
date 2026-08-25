"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { EmptyCart } from "./EmptyCart";
import { CartLineRow } from "./CartLineRow";
import { PromoCodeForm } from "./PromoCodeForm";
import { OrderSummary } from "./OrderSummary";
import { FulfillmentToggle } from "./FulfillmentToggle";
import { TimingPicker } from "./TimingPicker";
import { CustomerForm } from "./CustomerForm";
import { DraftHydration } from "./DraftHydration";
import { useCartStore } from "@/lib/cart/store";
import { useLineRemoval } from "@/lib/cart/use-line-removal";
import { useCartSummary } from "@/lib/cart/selectors";
import { useOrderDraftStore } from "@/lib/order/draft-store";
import { validateOrderDraft, validateTiming } from "@/lib/order/validation";
import { findZone } from "@/lib/fulfillment/delivery";
import { formatMoney } from "@/lib/money";

/**
 * The cart and order configuration.
 *
 * One client component holding the whole step, because every part of it reacts
 * to the same state: changing to pickup removes the delivery fee, hides the
 * address fields, re-checks the promotional code, and clears any scheduled
 * slot. Splitting that across routes would mean synchronising it.
 *
 * All money comes from `useCartSummary`, which is a pure derivation of the cart
 * lines — nothing here holds a total in state, so no figure can go stale.
 */
export function CartView({
  photoMap,
  categoryByItemId,
  addressLookupEnabled = false,
}: {
  photoMap: Record<string, string | null>;
  categoryByItemId: Record<string, string>;
  /** Resolved on the server: whether an address lookup service is connected. */
  addressLookupEnabled?: boolean;
}) {
  const router = useRouter();

  const lines = useCartStore((state) => state.lines);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const timing = useCartStore((state) => state.timing);
  const scheduledFor = useCartStore((state) => state.scheduledFor);
  const postalCode = useCartStore((state) => state.postalCode);

  const draft = useOrderDraftStore((state) => state.draft);
  const summary = useCartSummary();
  /*
   * Lines on their way out live here rather than in a row, so a row fading out
   * does not have to outlive itself. See `useLineRemoval`.
   */
  const { isLeaving, requestRemove, changeQuantity } = useLineRemoval();

  const [showErrors, setShowErrors] = useState(false);

  const fieldErrors = validateOrderDraft(draft, fulfillmentType);
  const zone = fulfillmentType === "delivery" ? findZone(postalCode) : null;
  const timingError = validateTiming(timing, scheduledFor, fulfillmentType, zone);

  const blockedByMinimum = summary.shortfall > 0;
  const canContinue =
    lines.length > 0 &&
    Object.keys(fieldErrors).length === 0 &&
    !timingError &&
    !blockedByMinimum &&
    summary.deliverable;

  /**
   * Why the customer can't continue, in the order they should fix things.
   *
   * A single generic "complete the highlighted details" is wrong whenever the
   * blocker isn't a form field — someone held up by a delivery minimum would be
   * sent hunting through a form that has nothing wrong with it.
   */
  const blockReason = (): string | null => {
    if (lines.length === 0) return "Your cart is empty.";
    if (!summary.deliverable) {
      return "We don't deliver to that postal code. Switch to pickup to continue.";
    }
    if (blockedByMinimum) {
      return `Delivery to this postal code starts at ${formatMoney(
        summary.shortfall + summary.totals.subtotal,
      )}. Add ${formatMoney(summary.shortfall)} more, or switch to pickup.`;
    }
    if (Object.keys(fieldErrors).length > 0) {
      return "Please complete the highlighted details above.";
    }
    if (timingError) return timingError;
    return null;
  };

  const handleContinue = () => {
    if (!canContinue) {
      setShowErrors(true);

      // Send the customer to whatever is actually blocking them. A field error
      // gets focus; a cart-level problem scrolls the summary into view, since
      // there is no input to focus.
      const firstErrorField = Object.keys(fieldErrors)[0];
      if (firstErrorField) {
        const field = document.getElementById(firstErrorField);
        field?.focus();
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (timingError) {
        document
          .getElementById("slot")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        document
          .getElementById("summary-heading")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    router.push("/checkout");
  };

  // Until the store has read localStorage, render nothing rather than an empty
  // cart that would flash away a moment later.
  if (!hasHydrated) {
    return (
      <Container className="py-20">
        <p className="sr-only" role="status">
          Loading your cart…
        </p>
      </Container>
    );
  }

  if (lines.length === 0) {
    return (
      <>
        <DraftHydration />
        <EmptyCart />
      </>
    );
  }

  return (
    <>
      <DraftHydration />
      <Container className="py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your cart
        </h1>
        <p className="mt-2 text-ink-muted">
          {summary.itemCount} {summary.itemCount === 1 ? "item" : "items"} ·{" "}
          <Link href="/menu" className="underline underline-offset-4 hover:text-ink">
            add something else
          </Link>
        </p>

        {/*
          `min-w-0` on both columns is load-bearing, not tidying.

          A grid item defaults to `min-width: auto`, which means it refuses to
          shrink below the intrinsic width of its content. An <input> carries an
          intrinsic width from its `size` attribute (20 characters) even when it
          is styled `w-full`, so the promo field held the summary column at
          367px — and on a 320px screen that pushed the whole page 63px wider
          than the viewport and carried the "Apply" button's centre off the
          right edge, where a finger cannot reach it.

          Fixing it at the column, rather than at the field, means anything else
          placed in either column can shrink too. Above `lg` there is room to
          spare, so nothing about the layout changes there.
        */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          {/* ── Left: lines and order configuration ─────────────────────── */}
          <div className="min-w-0">
            <section aria-labelledby="items-heading">
              <h2 id="items-heading" className="sr-only">
                Items in your cart
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {lines.map((line) => (
                  <CartLineRow
                    key={line.lineId}
                    line={line}
                    photoSrc={photoMap[line.imageSrc] ?? null}
                    categoryId={categoryByItemId[line.menuItemId] ?? "cat-burgers"}
                    leaving={isLeaving(line.lineId)}
                    onQuantityChange={changeQuantity}
                    onRemove={requestRemove}
                  />
                ))}
              </ul>
            </section>

            <div className="mt-10 space-y-10">
              <section aria-labelledby="fulfillment-heading">
                <h2 id="fulfillment-heading" className="sr-only">
                  Delivery or pickup
                </h2>
                <FulfillmentToggle />
              </section>

              <section aria-labelledby="timing-heading">
                <h2 id="timing-heading" className="sr-only">
                  Timing
                </h2>
                <TimingPicker error={showErrors ? timingError : null} />
              </section>

              <section aria-labelledby="details-heading">
                <h2 id="details-heading" className="sr-only">
                  Your details
                </h2>
                <CustomerForm
                  addressLookupEnabled={addressLookupEnabled}
                  fulfillmentType={fulfillmentType}
                  errors={fieldErrors}
                  showErrors={showErrors}
                />
              </section>
            </div>
          </div>

          {/* ── Right: money ─────────────────────────────────────────────── */}
          <aside aria-labelledby="summary-heading" className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
            <div className="rounded-card border border-line bg-surface p-6">
              <h2
                id="summary-heading"
                className="font-display text-xl font-semibold text-ink"
              >
                Order summary
              </h2>

              <div className="mt-5">
                <PromoCodeForm
                  promotion={summary.promotion}
                  promotionError={summary.promotionError}
                />
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <OrderSummary summary={summary} fulfillmentType={fulfillmentType} />
              </div>

              {blockedByMinimum && (
                <p
                  role="status"
                  className="mt-4 rounded-control bg-warning-soft p-3 text-sm text-warning"
                >
                  Add {formatMoney(summary.shortfall)} more to reach the minimum
                  for delivery to this postal code — or switch to pickup.
                </p>
              )}

              {!summary.deliverable && (
                <p
                  role="status"
                  className="mt-4 rounded-control bg-danger-soft p-3 text-sm text-danger"
                >
                  We don&rsquo;t deliver to that postal code yet. Pickup is still
                  available.
                </p>
              )}

              <button
                type="button"
                onClick={handleContinue}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-control bg-ember px-6 text-base font-semibold text-on-ember transition-colors hover:bg-ember-hover"
              >
                Continue to checkout
              </button>

              {showErrors && !canContinue && (
                <p role="alert" className="mt-3 text-sm font-medium text-danger">
                  {blockReason()}
                </p>
              )}

              <p className="mt-4 text-center text-xs text-ink-subtle">
                No payment is taken. This is a demonstration project.
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
