"use client";

import Link from "next/link";
import { FoodImage } from "@/components/menu/FoodImage";
import { QuantityStepper } from "@/components/menu/QuantityStepper";
import { formatMoney, formatDelta } from "@/lib/money";
import type { CartLine } from "@/lib/types";

/**
 * One line in the cart.
 *
 * Shows the unit price AND the line total separately. With customisations and a
 * quantity in play, "17,95 €" alone is ambiguous — people need to see both what
 * one costs and what they are being charged for this row.
 *
 * Removal is not this component's to own. The list holds it — see
 * `useLineRemoval` — so a row can fade out without needing to survive its own
 * disappearance. This one only reports which way it is going.
 */
export function CartLineRow({
  line,
  photoSrc,
  categoryId,
  leaving,
  onQuantityChange,
  onRemove,
}: {
  line: CartLine;
  photoSrc: string | null;
  categoryId: string;
  /** True while this line is fading out, just before it is removed. */
  leaving: boolean;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
}) {
  const lineTotal = line.unitPrice * line.quantity;
  const paidExtras = line.selections.filter((s) => s.priceDelta !== 0);
  const includedChoices = line.selections.filter((s) => s.priceDelta === 0);

  return (
    /*
      Two things happen on the way out, and both are on this element: the row
      fades, and the space it occupies collapses so the rows below rise into
      place instead of jumping when it is finally removed.

      The collapse is `grid-template-rows: 1fr → 0fr` around an
      `overflow-hidden` wrapper, which animates smoothly without anyone having
      to measure the row first. A browser that will not interpolate it simply
      keeps the fade, which is the part that carries the meaning.

      `aria-hidden` while leaving: the line is already gone as far as the
      customer is concerned, and a screen reader should not be walked back
      through something on its way out.
    */
    <li
      aria-hidden={leaving || undefined}
      className={`grid transition-[grid-template-rows,opacity] duration-[340ms] ease-out ${
        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      <div className="overflow-hidden">
        <div className="flex gap-4 py-6">
          <Link
            href={`/menu/${line.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-card border border-line bg-surface-sunken sm:h-28 sm:w-28"
          >
            {/* Decorative for the same reason as the menu card: the line's name is
            an adjacent link to the same dish. */}
            <FoodImage
              src={photoSrc}
              alt=""
              categoryId={categoryId}
              sizes="112px"
              glyphClassName="h-8 w-8"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-semibold leading-snug">
                <Link
                  href={`/menu/${line.slug}`}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {line.name}
                </Link>
              </h3>
              <p className="shrink-0 font-semibold tabular-nums text-ink">
                {formatMoney(lineTotal)}
              </p>
            </div>

            {includedChoices.length > 0 && (
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {includedChoices.map((choice) => choice.name).join(" · ")}
              </p>
            )}

            {paidExtras.length > 0 && (
              <ul className="mt-1 text-sm leading-relaxed text-ink-muted">
                {paidExtras.map((extra) => (
                  <li key={`${extra.groupId}-${extra.optionId}`}>
                    {extra.name}{" "}
                    <span className="tabular-nums text-ink-subtle">
                      {formatDelta(extra.priceDelta)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {line.notes && (
              <p className="mt-2 rounded-control bg-surface-sunken px-3 py-2 text-sm italic text-ink-muted">
                &ldquo;{line.notes}&rdquo;
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              {/* `allowRemove` lets minus fall off the bottom: at one it emits 0,
              and the list treats that as a removal — same path, same fade, as
              pressing Remove. */}
              <QuantityStepper
                quantity={line.quantity}
                onChange={(next) => onQuantityChange(line.lineId, next)}
                label=""
                allowRemove
                itemName={line.name}
              />

              <div className="flex items-center gap-4">
                <p className="text-sm tabular-nums text-ink-subtle">
                  {formatMoney(line.unitPrice)} each
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(line.lineId)}
                  disabled={leaving}
                  className="min-h-9 rounded-control px-2 text-sm font-medium text-ink-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
                >
                  Remove
                  <span className="sr-only"> {line.name} from your cart</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
