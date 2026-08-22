"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OptionGroupField } from "./OptionGroupField";
import { QuantityStepper } from "./QuantityStepper";
import { useCartStore } from "@/lib/cart/store";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import {
  canAddToCart,
  initialSelections,
  toSelectedOptions,
  toggleOption,
  totalPriceFor,
  unitPriceFor,
  unsatisfiedGroupIds,
  type SelectionState,
} from "@/lib/cart/customization";
import type { MenuItem } from "@/lib/types";

const NOTES_MAX = 200;

/**
 * The customisation form for any product.
 *
 * All state lives in `lib/cart/customization.ts`; this component renders it and
 * forwards taps. It has no idea whether it is showing a burger or a bottle of
 * water — it walks `item.optionGroups` and lets each group's own fields decide
 * how it behaves.
 *
 * Validation is deliberately deferred until the first add attempt. Marking
 * required groups red before the customer has done anything would be shouting
 * at them for not having finished yet; after a blocked attempt, the errors are
 * useful. On that attempt focus moves to the first unsatisfied group, so a
 * keyboard user is taken to the problem rather than left guessing why nothing
 * happened.
 */
export function ProductCustomizer({ item }: { item: MenuItem }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [selections, setSelections] = useState<SelectionState>(() =>
    initialSelections(item),
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const unitPrice = unitPriceFor(item, selections);
  const total = totalPriceFor(item, selections, quantity);
  const unsatisfied = unsatisfiedGroupIds(item, selections);
  const canAdd = canAddToCart(item, selections);

  const handleToggle = (groupId: string, optionId: string) => {
    setSelections((current) => toggleOption(item, current, groupId, optionId));
  };

  const handleAdd = () => {
    if (!canAdd) {
      setShowErrors(true);
      const first = unsatisfied[0];
      if (first) {
        const target = document.querySelector<HTMLElement>(
          `#group-${first} input:not(:disabled)`,
        );
        target?.focus();
        document
          .getElementById(`group-${first}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    addItem(item, toSelectedOptions(item, selections), quantity, notes);
    router.push("/cart");
  };

  const clampQuantity = (next: number) =>
    setQuantity(Math.min(Math.max(1, next), RESTAURANT.ordering.maxQuantityPerLine));

  return (
    <div>
      {item.optionGroups.length > 0 && (
        <div className="space-y-8">
          {item.optionGroups.map((group) => (
            <div key={group.id} id={`group-${group.id}`}>
              <OptionGroupField
                group={group}
                state={selections}
                onToggle={handleToggle}
                invalid={showErrors && unsatisfied.includes(group.id)}
                errorId={`error-${group.id}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Special instructions ──────────────────────────────────────────── */}
      <div className={item.optionGroups.length > 0 ? "mt-8" : ""}>
        <label
          htmlFor="special-instructions"
          className="font-display text-lg font-semibold text-ink"
        >
          Special instructions
        </label>
        <p className="mt-1 text-sm text-ink-muted">
          Anything the kitchen should know. We&rsquo;ll do our best, but we
          can&rsquo;t guarantee allergy-safe changes here — call us instead.
        </p>
        <textarea
          id="special-instructions"
          value={notes}
          onChange={(event) => setNotes(event.target.value.slice(0, NOTES_MAX))}
          rows={3}
          maxLength={NOTES_MAX}
          placeholder="e.g. cut in half, extra napkins"
          aria-describedby="notes-count"
          className="mt-3 w-full rounded-control border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-subtle"
        />
        <p id="notes-count" className="mt-1 text-right text-xs text-ink-subtle">
          {notes.length}/{NOTES_MAX}
        </p>
      </div>

      {/* ── Quantity ──────────────────────────────────────────────────────── */}
      <div className="mt-8 border-t border-line pt-6">
        <QuantityStepper quantity={quantity} onChange={clampQuantity} />
      </div>

      {/* ── Price breakdown ───────────────────────────────────────────────── */}
      <dl className="mt-6 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Each</dt>
          <dd className="font-medium tabular-nums text-ink">
            {formatMoney(unitPrice)}
          </dd>
        </div>
        {unitPrice !== item.basePrice && (
          <div className="flex justify-between gap-4 text-ink-subtle">
            <dt>Base {formatMoney(item.basePrice)} + options</dt>
            <dd className="tabular-nums">
              {formatMoney(unitPrice - item.basePrice)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {formatMoney(total)}
          </dd>
        </div>
      </dl>

      {/*
        Desktop action. The mobile equivalent lives in the sticky bar below, so
        the price and button are always reachable without scrolling back up.
      */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!item.available}
        aria-describedby={showErrors && !canAdd ? "add-error" : undefined}
        className="mt-6 hidden min-h-12 w-full items-center justify-center gap-3 rounded-control bg-ember px-6 text-base font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
      >
        {item.available ? (
          <>
            <span>Add {quantity > 1 ? `${quantity} ` : ""}to order</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </>
        ) : (
          "Currently unavailable"
        )}
      </button>

      {showErrors && !canAdd && (
        <p id="add-error" role="alert" className="mt-3 text-sm font-medium text-danger">
          Please make a choice in every required section above.
        </p>
      )}

      {/* ── Mobile sticky action bar ──────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md sm:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!item.available}
          className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-control bg-ember px-6 text-base font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.available ? (
            <>
              <span>Add {quantity > 1 ? `${quantity} ` : ""}to order</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </>
          ) : (
            "Currently unavailable"
          )}
        </button>
      </div>
    </div>
  );
}
