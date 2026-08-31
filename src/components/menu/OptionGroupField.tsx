"use client";

import { formatDelta } from "@/lib/money";
import { useTranslations } from "next-intl";
import { fromNextIntl } from "@/i18n/messages";
import { translateContent, type ContentTranslator } from "@/i18n/content";
import { groupRuleLabel, isGroupAtCapacity } from "@/lib/cart/customization";
import type { SelectionState } from "@/lib/cart/customization";
import type { OptionGroup } from "@/lib/types";

/**
 * Renders ONE option group — whatever kind it is.
 *
 * This component is the reason customisation isn't written per product. It
 * branches only on `group.selection`, so sizes, extras, sauces, removals and
 * upsells all come out of the same code path. A new kind of choice is new data.
 *
 * It uses real `<input type="radio">` / `<input type="checkbox">` inside a
 * `<fieldset>` with a `<legend>`, rather than divs with click handlers. That
 * buys arrow-key navigation within a radio group, space/enter toggling, the
 * correct "3 of 6" announcements, and grouping context — none of which would
 * come free from a styled div. The inputs are visually hidden but never
 * `display:none`, so they stay focusable and operable.
 */
export function OptionGroupField({
  group,
  state,
  onToggle,
  invalid,
  errorId,
}: {
  group: OptionGroup;
  state: SelectionState;
  onToggle: (groupId: string, optionId: string) => void;
  invalid: boolean;
  errorId: string;
}) {
  const t = useTranslations("product");
  const tg = useTranslations("optionGroups") as unknown as ContentTranslator;
  const to = useTranslations("options") as unknown as ContentTranslator;
  const tRoot = useTranslations();
  const messages = fromNextIntl(
    tRoot as (k: string, v?: Record<string, string | number>) => string,
  );

  const selected = state[group.id] ?? [];
  const atCapacity = isGroupAtCapacity(group, state);
  const isRadio = group.selection === "single";

  return (
    <fieldset
      className="border-0 p-0"
      aria-describedby={invalid ? errorId : undefined}
      aria-invalid={invalid || undefined}
    >
      <legend className="mb-1 flex w-full flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-lg font-semibold text-ink">
          {translateContent(tg, group.id, group.name)}
        </span>
        <span
          className={`text-xs font-medium ${
            invalid ? "text-danger" : "text-ink-subtle"
          }`}
        >
          {groupRuleLabel(group, messages)}
        </span>
      </legend>

      {group.description && (
        <p className="mb-3 text-sm text-ink-muted">
          {translateContent(tg, `${group.id}__description`, group.description)}
        </p>
      )}

      {invalid && (
        <p id={errorId} className="mb-3 text-sm font-medium text-danger">
          {t("chooseToContinue")}
        </p>
      )}

      <div className="space-y-2">
        {group.options.map((option) => {
          const isSelected = selected.includes(option.id);
          // At the cap, unselected options are disabled rather than silently
          // ignored — so the limit is visible before it's hit.
          const blocked = !option.available || (atCapacity && !isSelected);

          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                isSelected
                  ? "border-ember bg-ember-soft"
                  : "border-line bg-surface hover:border-line-strong"
              } ${blocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type={isRadio ? "radio" : "checkbox"}
                name={group.id}
                value={option.id}
                checked={isSelected}
                disabled={blocked}
                onChange={() => onToggle(group.id, option.id)}
                onClick={() => {
                  // A radio fires no `change` event when it is ALREADY checked,
                  // so clicking your current choice would be silently ignored —
                  // leaving optional single-select groups ("Make it a meal",
                  // "Add protein") impossible to undo. `click` still fires, so
                  // it handles exactly that case.
                  //
                  // `isSelected` here is the pre-click value from this render,
                  // so selecting a DIFFERENT option leaves this branch alone and
                  // `onChange` does the work — no double toggle.
                  if (isRadio && isSelected && !group.required) {
                    onToggle(group.id, option.id);
                  }
                }}
                className="sr-only"
              />

              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors ${
                  isRadio ? "rounded-full" : "rounded-[0.3rem]"
                } ${isSelected ? "border-ember bg-ember" : "border-line-strong bg-surface"}`}
              >
                {isSelected &&
                  (isRadio ? (
                    <span className="h-2 w-2 rounded-full bg-on-ember" />
                  ) : (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-on-ember">
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ))}
              </span>

              <span className="flex-1 text-sm font-medium text-ink">
                {translateContent(to, option.id, option.name)}
                {!option.available && (
                  <span className="ml-2 text-xs font-normal text-ink-subtle">
                    Unavailable
                  </span>
                )}
              </span>

              {option.priceDelta !== 0 && (
                <span className="shrink-0 text-sm font-semibold text-ink-muted">
                  {formatDelta(option.priceDelta)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
