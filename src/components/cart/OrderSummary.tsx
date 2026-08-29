"use client";

import { formatMoney } from "@/lib/money";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { RESTAURANT } from "@/lib/config/restaurant";
import { DiscountRow } from "./PromoCodeForm";
import type { CartSummary } from "@/lib/cart/selectors";
import type { FulfillmentType } from "@/lib/types";

/**
 * The money.
 *
 * Every figure comes from `calculateTotals`, which derives all of them from the
 * lines in one pass — so the rows shown here always add up to the total shown
 * here, because they are the same computation rather than two.
 *
 * VAT is listed as "incl." because menu prices already contain it. Showing it as
 * a row that gets added would overstate the bill by 19%.
 */
export function OrderSummary({
  summary,
  fulfillmentType,
}: {
  summary: CartSummary;
  fulfillmentType: FulfillmentType;
}) {
  const { totals, promotion, waiver, deliveryFeeBeforeWaiver } = summary;
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const money = (cents: number) => formatMoney(cents, locale);

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">{t("subtotal")}</dt>
        <dd className="tabular-nums text-ink">{money(totals.subtotal)}</dd>
      </div>

      {promotion && totals.discount > 0 && (
        <DiscountRow promotion={promotion} amount={totals.discount} />
      )}

      {fulfillmentType === "delivery" && (
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{t("deliveryFee")}</dt>
          <dd className="tabular-nums text-ink">
            {totals.deliveryFee === 0 ? (
              <>
                {deliveryFeeBeforeWaiver > 0 && (
                  <span className="mr-2 text-ink-subtle line-through">
                    {money(deliveryFeeBeforeWaiver)}
                  </span>
                )}
                <span className="font-medium text-herb">{t("deliveryFeeFree")}</span>
              </>
            ) : (
              money(totals.deliveryFee)
            )}
          </dd>
        </div>
      )}

      {waiver === "threshold" && (
        <p className="text-xs text-herb">
          {t("freeDeliveryOver", { threshold: money(RESTAURANT.fees.freeDeliveryThreshold) })}
        </p>
      )}

      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
        <dt className="font-display text-lg font-semibold text-ink">{t("total")}</dt>
        <dd className="font-display text-lg font-semibold tabular-nums text-ink">
          {money(totals.total)}
        </dd>
      </div>

      <p className="text-xs text-ink-subtle">
        {t("includesVat", { amount: money(totals.tax), rate: RESTAURANT.fees.taxRatePercent })}
      </p>
    </dl>
  );
}
