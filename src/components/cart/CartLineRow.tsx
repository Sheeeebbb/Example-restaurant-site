"use client";

import Link from "next/link";
import { FoodImage } from "@/components/menu/FoodImage";
import { QuantityStepper } from "@/components/menu/QuantityStepper";
import { formatMoney, formatDelta } from "@/lib/money";
import { useCartStore } from "@/lib/cart/store";
import type { CartLine } from "@/lib/types";

/**
 * One line in the cart.
 *
 * Shows the unit price AND the line total separately. With customisations and a
 * quantity in play, "17,95 €" alone is ambiguous — people need to see both what
 * one costs and what they are being charged for this row.
 */
export function CartLineRow({
  line,
  photoSrc,
  categoryId,
}: {
  line: CartLine;
  photoSrc: string | null;
  categoryId: string;
}) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);

  const lineTotal = line.unitPrice * line.quantity;
  const paidExtras = line.selections.filter((s) => s.priceDelta !== 0);
  const includedChoices = line.selections.filter((s) => s.priceDelta === 0);

  return (
    <li className="flex gap-4 py-6">
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
          {/* `allowRemove` lets minus fall off the bottom: at one it emits 0
              and `setQuantity` deletes the line, which is what pressing minus
              on a single item obviously means. */}
          <QuantityStepper
            quantity={line.quantity}
            onChange={(next) => setQuantity(line.lineId, next)}
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
              onClick={() => removeLine(line.lineId)}
              className="min-h-9 rounded-control px-2 text-sm font-medium text-ink-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
            >
              Remove
              <span className="sr-only"> {line.name} from your cart</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
