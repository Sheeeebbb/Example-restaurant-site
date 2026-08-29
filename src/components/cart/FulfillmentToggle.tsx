"use client";

import { useCartStore } from "@/lib/cart/store";
import { formatMoney } from "@/lib/money";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { findZone } from "@/lib/fulfillment/delivery";
import { DELIVERY_ZONES, RESTAURANT } from "@/lib/config/restaurant";
import type { FulfillmentType } from "@/lib/types";

/**
 * Delivery or pickup.
 *
 * A radio group, not two buttons: these are two states of one setting, and
 * radios give arrow-key navigation and "1 of 2" announcements for free.
 *
 * Switching clears any scheduled slot (see the store), because lead times
 * differ between the two — a pickup slot 25 minutes out may be unreachable
 * once travel time is added.
 */
/**
 * The cheapest delivery a customer could pay, across every zone and the flat
 * fallback. Quoted as a "from" price because the fee depends on the postal
 * code, which is not known yet at this point in the form — the toggle used to
 * state the flat fee as fact, which under-quoted an outer-zone address by
 * 1,50 € right up until checkout.
 */
const CHEAPEST_DELIVERY = Math.min(
  RESTAURANT.fees.deliveryFee,
  ...DELIVERY_ZONES.map((zone) => zone.deliveryFee),
);

/**
 * The two modes. Values are the domain's; the words come from the catalogue.
 *
 * `detail` takes the translator and the formatted fee rather than building a
 * sentence out of pieces — "{fee} · to your door" and "{fee} · tot aan je deur"
 * put the same value in the same slot of two different sentences.
 */
const CHOICES: {
  value: FulfillmentType;
  labelKey: string;
  detail: (
    t: (key: string, values?: Record<string, string | number>) => string,
    fee: number | null,
    money: (cents: number) => string,
  ) => string;
}[] = [
  {
    value: "delivery",
    labelKey: "delivery",
    detail: (t, fee, money) =>
      fee === null
        ? t("deliveryFrom", { fee: money(CHEAPEST_DELIVERY) })
        : t("deliveryDetail", { fee: money(fee) }),
  },
  {
    value: "pickup",
    labelKey: "pickup",
    detail: (t) => t("pickupDetail"),
  },
];

export function FulfillmentToggle() {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const money = (cents: number) => formatMoney(cents, locale);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const setFulfillmentType = useCartStore((state) => state.setFulfillmentType);
  const postalCode = useCartStore((state) => state.postalCode);

  // Once the postal code is known the exact fee is known, so show that instead
  // of the "from" price.
  const zone = findZone(postalCode);
  const knownFee = zone ? zone.deliveryFee : null;

  return (
    <fieldset className="border-0 p-0">
      <legend className="font-display text-xl font-semibold text-ink">
        {t("howWouldYouLikeIt")}
      </legend>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CHOICES.map((choice) => {
          const isSelected = fulfillmentType === choice.value;
          return (
            <label
              key={choice.value}
              className={`flex cursor-pointer items-center gap-3 rounded-card border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                isSelected
                  ? "border-ember bg-ember-soft"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="fulfillment"
                value={choice.value}
                checked={isSelected}
                onChange={() => setFulfillmentType(choice.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-ember bg-ember" : "border-line-strong bg-surface"
                }`}
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-on-ember" />}
              </span>
              <span>
                <span className="block font-semibold text-ink">{t(choice.labelKey)}</span>
                <span className="block text-sm text-ink-muted">
                  {choice.detail(t, knownFee, money)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
