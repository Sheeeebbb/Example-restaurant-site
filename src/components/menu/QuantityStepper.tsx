"use client";

import { RESTAURANT } from "@/lib/config/restaurant";

/**
 * Quantity control.
 *
 * The live value is announced through `role="status"` rather than by moving
 * focus, so a screen-reader user hears "2" after pressing plus without losing
 * their place. Buttons disable at the bounds instead of silently refusing.
 *
 * `allowRemove` decides what the bottom of the range means, because it differs
 * by where the stepper is standing. In the product panel one is the floor:
 * there is no such thing as ordering zero burgers, so minus stops there. In the
 * cart, one more press is plainly "I don't want this any more" — so minus at 1
 * emits 0, and the caller deletes the line. It used to be disabled instead,
 * which left the customer pressing a dead button and hunting for "Remove".
 */
export function QuantityStepper({
  quantity,
  onChange,
  label = "Quantity",
  allowRemove = false,
  itemName,
  size = "md",
}: {
  quantity: number;
  onChange: (next: number) => void;
  label?: string;
  /** Let minus go below one, emitting 0 for the caller to treat as a removal. */
  allowRemove?: boolean;
  /** Names the buttons for assistive tech where several steppers share a page. */
  itemName?: string;
  size?: "sm" | "md";
}) {
  const max = RESTAURANT.ordering.maxQuantityPerLine;
  const removes = allowRemove && quantity <= 1;
  const of = itemName ? ` of ${itemName}` : "";
  const box = size === "sm" ? "h-9 w-9 text-base" : "h-11 w-11 text-lg";
  const readout = size === "sm" ? "w-8 text-sm" : "w-10 text-base";

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <div className="flex items-center rounded-control border border-line-strong bg-surface">
        <button
          type="button"
          onClick={() => onChange(quantity - 1)}
          disabled={quantity <= 1 && !allowRemove}
          aria-label={
            removes ? `Remove ${itemName ?? "item"} from your cart` : `Decrease quantity${of}`
          }
          className={`flex items-center justify-center rounded-l-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${box} ${
            removes ? "text-ink hover:bg-danger-soft hover:text-danger" : "text-ink hover:bg-surface-sunken"
          }`}
        >
          <span aria-hidden="true">−</span>
        </button>

        <span
          role="status"
          aria-live="polite"
          className={`text-center font-semibold tabular-nums text-ink ${readout}`}
        >
          {quantity}
        </span>

        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          disabled={quantity >= max}
          aria-label={`Increase quantity${of}`}
          className={`flex items-center justify-center rounded-r-control font-medium text-ink transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 ${box}`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
