"use client";

import { useCartStore } from "@/lib/cart/store";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
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
const CHOICES: {
  value: FulfillmentType;
  label: string;
  detail: (fee: number) => string;
}[] = [
  {
    value: "delivery",
    label: "Delivery",
    detail: (fee) => `${formatMoney(fee)} · to your door`,
  },
  {
    value: "pickup",
    label: "Pickup",
    detail: () => "Free · collect from us",
  },
];

export function FulfillmentToggle() {
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const setFulfillmentType = useCartStore((state) => state.setFulfillmentType);

  return (
    <fieldset className="border-0 p-0">
      <legend className="font-display text-xl font-semibold text-ink">
        How would you like it?
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
                <span className="block font-semibold text-ink">{choice.label}</span>
                <span className="block text-sm text-ink-muted">
                  {choice.detail(RESTAURANT.fees.deliveryFee)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
