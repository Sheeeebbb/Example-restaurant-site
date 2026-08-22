"use client";

import { formatMoney } from "@/lib/money";
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

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Subtotal</dt>
        <dd className="tabular-nums text-ink">{formatMoney(totals.subtotal)}</dd>
      </div>

      {promotion && totals.discount > 0 && (
        <DiscountRow promotion={promotion} amount={totals.discount} />
      )}

      {fulfillmentType === "delivery" && (
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Delivery</dt>
          <dd className="tabular-nums text-ink">
            {totals.deliveryFee === 0 ? (
              <>
                {deliveryFeeBeforeWaiver > 0 && (
                  <span className="mr-2 text-ink-subtle line-through">
                    {formatMoney(deliveryFeeBeforeWaiver)}
                  </span>
                )}
                <span className="font-medium text-herb">Free</span>
              </>
            ) : (
              formatMoney(totals.deliveryFee)
            )}
          </dd>
        </div>
      )}

      {waiver === "threshold" && (
        <p className="text-xs text-herb">
          Free delivery on orders over{" "}
          {formatMoney(RESTAURANT.fees.freeDeliveryThreshold)}.
        </p>
      )}

      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
        <dt className="font-display text-lg font-semibold text-ink">Total</dt>
        <dd className="font-display text-lg font-semibold tabular-nums text-ink">
          {formatMoney(totals.total)}
        </dd>
      </div>

      <p className="text-xs text-ink-subtle">
        Includes {formatMoney(totals.tax)} VAT at{" "}
        {RESTAURANT.fees.taxRatePercent}%.
      </p>
    </dl>
  );
}
