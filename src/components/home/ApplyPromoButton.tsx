"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { useCartStore } from "@/lib/cart/store";

/**
 * Applies the promo code to the cart for real.
 *
 * It writes the code into the same store the cart and checkout read, so the
 * discount is calculated by `calculateTotals` from here on. Nothing is faked:
 * the code is stored, not the discount, and it is re-validated against the live
 * subtotal every time the cart renders. If the basket is still under the
 * minimum, the cart will say so rather than this button promising otherwise.
 */
export function ApplyPromoButton({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const t = useTranslations("home");
  const setPromotionCode = useCartStore((state) => state.setPromotionCode);
  const [applied, setApplied] = useState(false);

  const apply = () => {
    setPromotionCode(code);
    setApplied(true);
    window.setTimeout(() => setApplied(false), 2600);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={apply}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-ember px-6 text-base font-medium text-on-ember transition-colors hover:bg-ember-hover lg:w-auto"
      >
        {applied ? t("promoApplied") : t("promoApply")}
      </button>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-poster-muted">
        {applied
          ? t("promoSaved")
          : ""}
      </p>
    </div>
  );
}
