"use client";

import { RESTAURANT } from "@/lib/config/restaurant";

/**
 * Quantity control.
 *
 * The live value is announced through `role="status"` rather than by moving
 * focus, so a screen-reader user hears "2" after pressing plus without losing
 * their place. Buttons disable at the bounds instead of silently refusing.
 */
export function QuantityStepper({
  quantity,
  onChange,
  label = "Quantity",
}: {
  quantity: number;
  onChange: (next: number) => void;
  label?: string;
}) {
  const max = RESTAURANT.ordering.maxQuantityPerLine;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center rounded-control border border-line-strong bg-surface">
        <button
          type="button"
          onClick={() => onChange(quantity - 1)}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="flex h-11 w-11 items-center justify-center rounded-l-control text-lg font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">−</span>
        </button>

        <span
          role="status"
          aria-live="polite"
          className="w-10 text-center text-base font-semibold tabular-nums text-ink"
        >
          {quantity}
        </span>

        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          disabled={quantity >= max}
          aria-label="Increase quantity"
          className="flex h-11 w-11 items-center justify-center rounded-r-control text-lg font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
