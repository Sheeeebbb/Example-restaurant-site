"use client";

import { useMemo } from "react";
import { useCartStore } from "@/lib/cart/store";
import { generateSlots, earliestReadyTime } from "@/lib/fulfillment/scheduling";
import { findZone } from "@/lib/fulfillment/delivery";
import { RESTAURANT } from "@/lib/config/restaurant";

/**
 * ASAP or a booked slot.
 *
 * Slots are generated from the restaurant's opening hours and the current lead
 * time, so the list shortens through the evening and empties when the kitchen
 * stops taking orders. Nothing offered here is unreachable at the moment it is
 * rendered — but a slot can go stale while the form is being filled in, so the
 * choice is re-validated before the customer continues.
 */
export function TimingPicker({ error }: { error: string | null }) {
  const timing = useCartStore((state) => state.timing);
  const scheduledFor = useCartStore((state) => state.scheduledFor);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const postalCode = useCartStore((state) => state.postalCode);
  const setTiming = useCartStore((state) => state.setTiming);
  const setScheduledFor = useCartStore((state) => state.setScheduledFor);

  const { days, readyLabel } = useMemo(() => {
    const now = new Date();
    const zone = fulfillmentType === "delivery" ? findZone(postalCode) : null;
    const ready = earliestReadyTime(now, fulfillmentType, zone);
    const minutes = Math.round((ready.getTime() - now.getTime()) / 60000);
    return {
      days: generateSlots(now, fulfillmentType, zone),
      readyLabel: `about ${minutes} minutes`,
    };
  }, [fulfillmentType, postalCode]);

  const noSlots = days.length === 0;

  return (
    <fieldset className="border-0 p-0">
      <legend className="font-display text-xl font-semibold text-ink">
        When?
      </legend>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { value: "asap" as const, label: "As soon as possible", detail: readyLabel },
          {
            value: "scheduled" as const,
            label: "Schedule for later",
            detail: noSlots ? "No times left today" : "Choose a time",
          },
        ].map((choice) => {
          const isSelected = timing === choice.value;
          const disabled = choice.value === "scheduled" && noSlots;
          return (
            <label
              key={choice.value}
              className={`flex cursor-pointer items-center gap-3 rounded-card border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                isSelected
                  ? "border-ember bg-ember-soft"
                  : "border-line bg-surface hover:border-line-strong"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="timing"
                value={choice.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => setTiming(choice.value)}
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
                <span className="block text-sm text-ink-muted">{choice.detail}</span>
              </span>
            </label>
          );
        })}
      </div>

      {timing === "scheduled" && !noSlots && (
        <div className="mt-4">
          <label htmlFor="slot" className="text-sm font-medium text-ink">
            Pick a time
          </label>
          <select
            id="slot"
            value={scheduledFor ?? ""}
            onChange={(event) => setScheduledFor(event.target.value || undefined)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "timing-error" : undefined}
            className="mt-2 min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink"
          >
            <option value="">Choose a time…</option>
            {days.map((day) => (
              <optgroup key={day.date} label={day.label}>
                {day.slots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-2 text-xs text-ink-subtle">
            Times are shown for {RESTAURANT.address.city}.
          </p>
        </div>
      )}

      {error && (
        <p id="timing-error" role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
