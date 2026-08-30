"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/cart/store";
import { useTranslations } from "next-intl";
import { fromNextIntl } from "@/i18n/messages";
import { validatePromotion } from "@/lib/data/promotions";
import { calculateSubtotal } from "@/lib/cart/totals";
import { formatMoney } from "@/lib/money";
import type { Promotion } from "@/lib/types";

/**
 * Promotional code entry.
 *
 * DUPLICATE DISCOUNTS ARE STRUCTURALLY IMPOSSIBLE, not merely prevented here:
 * the cart stores a single `promotionCode` string, so applying a second code
 * replaces the first rather than stacking. There is no code path that can add
 * one discount twice.
 *
 * The applied code is stored, never the discount it produced. `calculateTotals`
 * re-derives the amount from the live subtotal on every render, so removing
 * items or changing to pickup re-prices — or invalidates — the discount
 * immediately. A stored discount figure would go stale the moment the basket
 * changed.
 */
export function PromoCodeForm({
  promotion,
  promotionError,
}: {
  promotion: Promotion | null;
  promotionError: string | null;
}) {
  const lines = useCartStore((state) => state.lines);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const appliedCode = useCartStore((state) => state.promotionCode);
  const setPromotionCode = useCartStore((state) => state.setPromotionCode);

  const [input, setInput] = useState("");
  const [message, setMessage] = useState<
    { tone: "error" | "info"; text: string } | null
  >(null);

  const t = useTranslations("cart");
  const tRoot = useTranslations();
  const messages = fromNextIntl(
    tRoot as (k: string, v?: Record<string, string | number>) => string,
  );

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const code = input.trim().toUpperCase();
    if (!code) return;

    if (appliedCode && code === appliedCode.toUpperCase()) {
      setMessage({ tone: "info", text: t("promoAlreadyApplied", { code }) });
      setInput("");
      return;
    }

    const result = validatePromotion(
      code,
      calculateSubtotal(lines),
      fulfillmentType,
      new Date(),
      messages,
    );

    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }

    const replaced = appliedCode && appliedCode.toUpperCase() !== code;
    setPromotionCode(result.promotion.code);
    setMessage(
      replaced
        ? { tone: "info", text: t("promoReplaced", { code, previous: appliedCode }) }
        : null,
    );
    setInput("");
  };

  const remove = () => {
    setPromotionCode(undefined);
    setMessage(null);
  };

  const applied = Boolean(appliedCode);

  return (
    <div className="space-y-3">
      {/* An applied code that no longer qualifies — the basket shrank below its
          minimum, or the customer switched to pickup. Say so, and let them
          drop it. The code itself is kept: if they add another item it becomes
          valid again on its own. */}
      {applied && promotionError && (
        <div className="rounded-card border border-warning bg-warning-soft p-4">
          <p className="text-sm font-medium text-warning">
            {appliedCode} can&rsquo;t be used right now
          </p>
          <p className="mt-1 text-sm text-ink-muted">{promotionError}</p>
          <button
            type="button"
            onClick={remove}
            className="mt-3 min-h-9 text-sm font-medium text-ink underline underline-offset-4"
          >
            Remove code
            <span className="sr-only"> {appliedCode}</span>
          </button>
        </div>
      )}

      {promotion && (
        <div className="flex items-start justify-between gap-4 rounded-card border border-herb bg-herb-soft p-4">
          <div>
            <p className="text-sm font-semibold text-herb">
              {promotion.code} applied
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {promotion.description}
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            className="min-h-9 shrink-0 text-sm font-medium text-ink underline underline-offset-4 hover:text-danger"
          >
            Remove
            <span className="sr-only"> promotional code {promotion.code}</span>
          </button>
        </div>
      )}

      {/*
        The input stays available even while a code is applied, so a customer
        can swap one for another without removing the first. Applying a second
        code REPLACES the first — the cart holds a single code, so two discounts
        can never stack.
      */}
      <form onSubmit={apply} noValidate>
        <label htmlFor="promo-code" className="text-sm font-medium text-ink">
          {applied ? t("promoTryAnother") : t("promoLabel")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="promo-code"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (message) setMessage(null);
            }}
            placeholder={applied ? t("promoAnother") : "WELCOME20"}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={message?.tone === "error" || undefined}
            aria-describedby={message ? "promo-message" : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-sm uppercase text-ink placeholder:normal-case placeholder:text-ink-subtle"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="min-h-11 shrink-0 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>

        {message && (
          <p
            id="promo-message"
            role="status"
            className={`mt-2 text-sm ${
              message.tone === "error" ? "text-danger" : "text-ink-muted"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}

/** Shown in the summary when a discount is active. */
export function DiscountRow({
  promotion,
  amount,
}: {
  promotion: Promotion;
  amount: number;
}) {
  return (
    <div className="flex justify-between gap-4 text-herb">
      <dt>Discount ({promotion.code})</dt>
      <dd className="tabular-nums">−{formatMoney(amount)}</dd>
    </div>
  );
}
