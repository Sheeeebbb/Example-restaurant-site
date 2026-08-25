"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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

/** The same cap the server enforces — one number, not two that can drift. */
const NOTES_MAX = RESTAURANT.ordering.maxNoteLength;

/**
 * How long the button holds its "Added" state before the panel that owns it
 * closes. Long enough to read, short enough that a second dish is never held
 * up — the cart badge carries the confirmation from here on.
 */
const ADDED_MS = 550;

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
 *
 * `onAdded` decides what a successful add means for whoever is hosting the
 * form. The product page has nowhere to go but the cart, so it navigates. The
 * menu's product panel passes a handler instead, holds the confirmation for a
 * beat and closes — the customer stays in the menu and keeps ordering.
 */
export function ProductCustomizer({
  item,
  onAdded,
  actionSlot = null,
}: {
  item: MenuItem;
  onAdded?: () => void;
  /**
   * Somewhere else to put the add button.
   *
   * The product page leaves it in the flow: the page scrolls, and a bar stuck
   * to the bottom of the viewport has the footer beneath it to stick against.
   * The product panel has no such room — its scroll area ends with this form,
   * so a `sticky` bar there would simply sit at the end of the content and
   * scroll away with it. The panel passes its own footer element instead and
   * the button is rendered into it, which keeps every piece of state, pricing
   * and validation in this one component.
   */
  actionSlot?: HTMLElement | null;
}) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [selections, setSelections] = useState<SelectionState>(() =>
    initialSelections(item),
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [added, setAdded] = useState(false);

  const unitPrice = unitPriceFor(item, selections);
  const total = totalPriceFor(item, selections, quantity);
  const unsatisfied = unsatisfiedGroupIds(item, selections);
  const canAdd = canAddToCart(item, selections);

  const handleToggle = (groupId: string, optionId: string) => {
    setSelections((current) => toggleOption(item, current, groupId, optionId));
  };

  const handleAdd = () => {
    // A second tap while the confirmation is showing would add the line twice
    // for one intent — the button is still on screen, so guard it here.
    if (added) return;

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

    if (!onAdded) {
      router.push("/cart");
      return;
    }

    setAdded(true);
    window.setTimeout(onAdded, ADDED_MS);
  };

  const clampQuantity = (next: number) =>
    setQuantity(Math.min(Math.max(1, next), RESTAURANT.ordering.maxQuantityPerLine));

  /*
   * The reason a press was refused, next to the button that refused it.
   *
   * This message used to sit further down the component body while the button
   * was portalled into the panel's footer — so on a phone the explanation
   * rendered below the fold of the scrolling body and the customer saw a tap
   * that did nothing. Spring Water, which requires a still-or-sparkling choice
   * and pre-selects neither, was the dish that made it obvious.
   *
   * Bundling the two means the message cannot be separated from the control
   * again, wherever the button is rendered.
   */
  const addButton = (
    <button
      type="button"
      onClick={handleAdd}
      disabled={!item.available}
      aria-describedby={showErrors && !canAdd ? "add-error" : undefined}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-control px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        added
          ? "bg-herb text-on-herb"
          : "bg-ember text-on-ember hover:bg-ember-hover"
      }`}
    >
      <AddLabel
        available={item.available}
        added={added}
        quantity={quantity}
        total={total}
      />
    </button>
  );

  const actionButton = (
    <>
      {showErrors && !canAdd && (
        <p
          id="add-error"
          role="alert"
          className="mb-2 text-sm font-medium text-danger"
        >
          Choose an option in every required section to continue.
        </p>
      )}
      {addButton}
    </>
  );

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

      {/*
        ── Special instructions ────────────────────────────────────────────
        Folded away rather than always open. A dish with no options would
        otherwise present a bare textarea as its entire "customisation", which
        reads as an empty form; and on a burger with six option groups the box
        is one more thing to scroll past. Native `<details>` keeps it one tap
        away, with keyboard and screen-reader behaviour for free. A note the
        customer has typed keeps the panel open so it can't be hidden by
        accident.
      */}
      <details
        open={notes.length > 0}
        className={`group rounded-control border border-line bg-surface ${
          item.optionGroups.length > 0 ? "mt-8" : ""
        }`}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          Add a note for the kitchen
          <span
            aria-hidden="true"
            className="text-ink-subtle transition-transform group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>

        <div className="border-t border-line p-3">
          <label htmlFor="special-instructions" className="text-sm text-ink-muted">
            Anything the kitchen should know. We&rsquo;ll do our best, but we
            can&rsquo;t guarantee allergy-safe changes here — call us instead.
          </label>
          <textarea
            id="special-instructions"
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, NOTES_MAX))}
            rows={3}
            maxLength={NOTES_MAX}
            placeholder="e.g. cut in half, extra napkins"
            aria-describedby="notes-count"
            className="mt-3 w-full rounded-control border border-line bg-paper p-3 text-sm text-ink placeholder:text-ink-subtle"
          />
          <p id="notes-count" className="mt-1 text-right text-xs text-ink-subtle">
            {notes.length}/{NOTES_MAX}
          </p>
        </div>
      </details>

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
        The action itself. Rendered inline on the product page and into the
        panel's footer when one is supplied — same button, same handler, one
        label, so the two placements cannot drift apart.
      */}
      {actionSlot ? (
        createPortal(actionButton, actionSlot)
      ) : (
        <>
          <div className="mt-6 hidden sm:block">{actionButton}</div>

          {/*
            Mobile: pinned above the fold-line while the page scrolls past.

            The bottom padding clears the iOS home indicator, the same way the
            product panel's footer does. Without it the primary action on this
            page sits under the gesture bar on every recent iPhone — the button
            is drawn, and the bottom of it is not reliably tappable.
          */}
          <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
            {actionButton}
          </div>
        </>
      )}

      {/*
        Confirms the add to assistive tech. The visual "Added" state is colour
        and an icon, neither of which a screen reader announces on its own.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {added ? `${item.name} added to cart` : ""}
      </span>
    </div>
  );
}

/** The button's three possible readings: unavailable, ready to add, just added. */
function AddLabel({
  available,
  added,
  quantity,
  total,
}: {
  available: boolean;
  added: boolean;
  quantity: number;
  total: number;
}) {
  if (!available) return <>Currently unavailable</>;

  if (added) {
    return (
      <span className="inline-flex items-center gap-2 motion-safe:animate-[added-pop_180ms_ease-out]">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="m4 10.5 4 4 8-9" />
        </svg>
        Added
      </span>
    );
  }

  return (
    <>
      <span>Add {quantity > 1 ? `${quantity} ` : ""}to cart</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{formatMoney(total)}</span>
    </>
  );
}
