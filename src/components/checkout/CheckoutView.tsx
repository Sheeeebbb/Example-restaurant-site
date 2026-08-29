"use client";

import { useTranslations, useLocale } from "next-intl";
import { fromNextIntl } from "@/i18n/messages";
import type { Locale } from "@/i18n/config";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { CustomerForm } from "@/components/cart/CustomerForm";
import { FulfillmentToggle } from "@/components/cart/FulfillmentToggle";
import { TimingPicker } from "@/components/cart/TimingPicker";
import { DraftHydration } from "@/components/cart/DraftHydration";
import { EditableSection } from "./EditableSection";
import { MockPaymentForm } from "./MockPaymentForm";
import { useCartStore } from "@/lib/cart/store";
import { useCartSummary } from "@/lib/cart/selectors";
import { useOrderDraftStore } from "@/lib/order/draft-store";
import { useOrderStore } from "@/lib/order/order-store";
import { validateOrderDraft, validateTiming } from "@/lib/order/validation";
import { findZone } from "@/lib/fulfillment/delivery";
import { EMPTY_CARD, validateCard, type CardDraft } from "@/lib/payments/card-mock";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import { FORMATTING } from "@/i18n/config";
import type { PlaceOrderRequest } from "@/lib/order/place-order";
import type { Order } from "@/lib/types";

/**
 * Checkout.
 *
 * The client validates everything for fast feedback, then sends the order to
 * `/api/checkout`, which validates it all again and — crucially — recomputes
 * every price from the menu. The totals shown here are a preview; the server's
 * figure is what gets charged. Card details are not part of that request.
 */
export function CheckoutView() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const messages = fromNextIntl(t as (k: string, v?: Record<string, string | number>) => string);
  const router = useRouter();

  const lines = useCartStore((state) => state.lines);
  const cartHydrated = useCartStore((state) => state.hasHydrated);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const timing = useCartStore((state) => state.timing);
  const scheduledFor = useCartStore((state) => state.scheduledFor);
  const postalCode = useCartStore((state) => state.postalCode);
  const promotionCode = useCartStore((state) => state.promotionCode);
  const clearCart = useCartStore((state) => state.clearCart);

  const draft = useOrderDraftStore((state) => state.draft);
  const draftHydrated = useOrderDraftStore((state) => state.hasHydrated);
  const clearDraft = useOrderDraftStore((state) => state.clearDraft);

  const saveOrder = useOrderStore((state) => state.saveOrder);
  const summary = useCartSummary();

  const [card, setCard] = useState<CardDraft>(EMPTY_CARD);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const fieldErrors = validateOrderDraft(draft, fulfillmentType, messages);
  const zone = fulfillmentType === "delivery" ? findZone(postalCode) : null;
  const timingError = validateTiming(timing, scheduledFor, fulfillmentType, zone);
  const cardErrors = validateCard(card);

  const detailsValid = Object.keys(fieldErrors).length === 0;
  const cardValid = Object.keys(cardErrors).length === 0;
  const ready = cartHydrated && draftHydrated;

  const toggle = (id: string) => setOpenSection((open) => (open === id ? null : id));

  const placeOrder = async () => {
    setServerError(null);

    if (!detailsValid || timingError || !cardValid) {
      setShowErrors(true);
      // Open whichever section is hiding the problem, so the error the customer
      // is being told about is actually on screen.
      if (!detailsValid) setOpenSection("details");
      else if (timingError) setOpenSection("timing");
      return;
    }

    setSubmitting(true);
    try {
      // Note what is sent: item and option IDS, quantities, notes. No prices,
      // and no card details — the card never leaves this component.
      const payload: PlaceOrderRequest = {
        lines: lines.map((line) => ({
          menuItemId: line.menuItemId,
          optionIds: line.selections.map((selection) => selection.optionId),
          quantity: line.quantity,
          notes: line.notes,
        })),
        fulfillment: { type: fulfillmentType, timing, scheduledFor },
        draft,
        promotionCode,
      };

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as
        | { ok: true; order: Order }
        | { ok: false; error: string; field?: string };

      if (!result.ok) {
        setServerError(result.error);
        setShowErrors(true);
        setSubmitting(false);
        return;
      }

      // Order first, then clear — if saving somehow failed we would rather have
      // a stale cart than a paid-for order the customer can't see.
      saveOrder(result.order);
      setCard(EMPTY_CARD);
      clearCart();
      clearDraft();
      router.push(`/order/${result.order.reference}`);
    } catch {
      setServerError(t("errors.network"));
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <>
        <DraftHydration />
        <Container className="py-20">
          <p role="status" className="text-ink-muted">
            Loading your order…
          </p>
        </Container>
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <Container className="py-20 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Nothing to check out
        </h1>
        <p className="mt-3 text-ink-muted">{t("validation.cartEmpty")}</p>
        <Link
          href="/menu"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-control bg-ember px-6 font-semibold text-on-ember"
        >
          Browse Menu
        </Link>
      </Container>
    );
  }

  const money = (cents: number) => formatMoney(cents, locale);

  const whenLabel =
    timing === "scheduled" && scheduledFor
      ? /*
         * The reader's language, the restaurant's clock. `timeZone` is pinned
         * so a customer abroad still sees the hour the shop will have it ready.
         */
        new Intl.DateTimeFormat(FORMATTING[locale].dateTime, {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: RESTAURANT.timeZone,
        }).format(new Date(scheduledFor))
      : t("timing.asap");

  return (
    <>
      <DraftHydration />
      <Container className="py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 text-ink-muted">
          <Link href="/cart" className="underline underline-offset-4 hover:text-ink">
            Back to cart
          </Link>
        </p>

        {/*
          `min-w-0` for the same reason as the cart's columns: a grid item
          will not shrink below its content's intrinsic width, and the card
          and address fields in this column carry one. Without it a 320px
          screen scrolls sideways and the controls nearest the right edge
          drift out of reach.
        */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div className="min-w-0 space-y-4">
            <EditableSection
              title={t("checkout.contactDetails")}
              open={openSection === "details"}
              onToggle={() => toggle("details")}
              invalid={showErrors && !detailsValid}
              summary={
                draft.name ? (
                  <>
                    {draft.name}
                    <br />
                    {draft.phone} · {draft.email}
                    {fulfillmentType === "delivery" && draft.street && (
                      <>
                        <br />
                        {draft.street} {draft.houseNumber}, {draft.postalCode}{" "}
                        {draft.city}
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-danger">{t("checkout.notFilledIn")}</span>
                )
              }
            >
              <CustomerForm
                fulfillmentType={fulfillmentType}
                errors={fieldErrors}
                showErrors={showErrors}
              />
            </EditableSection>

            <EditableSection
              title={t("checkout.orderType")}
              open={openSection === "fulfillment"}
              onToggle={() => toggle("fulfillment")}
              summary={
                fulfillmentType === "delivery"
                  ? t("checkout.deliveryWithFee", { fee: money(summary.deliveryFeeBeforeWaiver) })
                  : t("checkout.pickupFree")
              }
            >
              <FulfillmentToggle />
            </EditableSection>

            <EditableSection
              title={t("checkout.timing")}
              open={openSection === "timing"}
              onToggle={() => toggle("timing")}
              invalid={showErrors && Boolean(timingError)}
              summary={whenLabel}
            >
              <TimingPicker error={showErrors ? timingError : null} />
            </EditableSection>

            <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
              <MockPaymentForm
                card={card}
                errors={cardErrors}
                showErrors={showErrors}
                disabled={submitting}
                onChange={(f, value) => setCard((c) => ({ ...c, [f]: value }))}
              />
            </div>
          </div>

          {/* ── Summary and submit ───────────────────────────────────────── */}
          <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
            <div className="rounded-card border border-line bg-surface p-6">
              <h2 className="font-display text-xl font-semibold text-ink">
                Order summary
              </h2>

              <ul className="mt-4 divide-y divide-line border-y border-line">
                {lines.map((line) => (
                  <li key={line.lineId} className="flex justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {line.quantity} × {line.name}
                      </p>
                      {line.selections.length > 0 && (
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                          {line.selections.map((s) => s.name).join(" · ")}
                        </p>
                      )}
                      {line.notes && (
                        <p className="mt-0.5 text-xs italic text-ink-muted">
                          &ldquo;{line.notes}&rdquo;
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm tabular-nums text-ink">
                      {money(line.unitPrice * line.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <OrderSummary summary={summary} fulfillmentType={fulfillmentType} />
              </div>

              {serverError && (
                <p
                  role="alert"
                  className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger"
                >
                  {serverError}
                </p>
              )}

              <button
                type="button"
                onClick={placeOrder}
                disabled={submitting}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-control bg-ember px-6 text-base font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? t("checkout.placing")
                  : t("checkout.placeOrder", { total: money(summary.totals.total) })}
              </button>

              {showErrors && !serverError && (!detailsValid || timingError || !cardValid) && (
                <p role="alert" className="mt-3 text-sm font-medium text-danger">
                  {!detailsValid
                    ? t("checkout.completeDetails")
                    : timingError
                      ? timingError
                      : t("validation.cardDetails")}
                </p>
              )}

              <p className="mt-4 text-center text-xs text-ink-subtle">
                {t("checkout.noPaymentStored")}
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
