"use client";

import { useId, useMemo, useState } from "react";
import { useCartStore } from "@/lib/cart/store";
import {
  generateSlots,
  earliestReadyTime,
  isAcceptingOrdersAt,
} from "@/lib/fulfillment/scheduling";
import { findZone } from "@/lib/fulfillment/delivery";
import { RESTAURANT } from "@/lib/config/restaurant";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";

/**
 * ASAP or a booked slot.
 *
 * Slots are generated from the restaurant's opening hours and the current lead
 * time, so the list shortens through the evening and empties when the kitchen
 * stops taking orders. Nothing offered here is unreachable at the moment it is
 * rendered — but a slot can go stale while the form is being filled in, so the
 * choice is re-validated before the customer continues.
 *
 * ── Why a day, then a time ──────────────────────────────────────────────────
 * Six days at fifteen-minute intervals is around 240 bookable slots. As one
 * flat <select> that is a single control holding 240 options: on Android it
 * opens a full-screen list that has to be flicked through, and picking next
 * Tuesday evening means scrolling past two hundred times that are not it.
 *
 * `generateSlots` has always returned the slots grouped by day — the old
 * picker flattened that grouping into <optgroup>s and threw the hierarchy
 * away. This renders it instead: pick a day, then pick from that day's forty
 * or so times. Nothing about which slots exist has changed.
 *
 * Both groups are native radios, so arrow keys move within a group, Tab moves
 * between them, and a screen reader announces "3 of 6, selected" without any
 * ARIA to keep in sync.
 */
export function TimingPicker({ error }: { error: string | null }) {
  const timing = useCartStore((state) => state.timing);
  const scheduledFor = useCartStore((state) => state.scheduledFor);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const postalCode = useCartStore((state) => state.postalCode);
  const setTiming = useCartStore((state) => state.setTiming);
  const setScheduledFor = useCartStore((state) => state.setScheduledFor);

  const t = useTranslations("timing");
  const tc = useTranslations("checkout");
  const locale = useLocale() as Locale;

  const { days, readyMinutes, acceptingNow } = useMemo(() => {
    const now = new Date();
    const zone = fulfillmentType === "delivery" ? findZone(postalCode) : null;
    const ready = earliestReadyTime(now, fulfillmentType, zone);
    return {
      /* Slot generation is identical in every language; only the labels differ. */
      days: generateSlots(now, fulfillmentType, zone, 0, locale),
      readyMinutes: Math.round((ready.getTime() - now.getTime()) / 60000),
      acceptingNow: isAcceptingOrdersAt(now),
    };
  }, [fulfillmentType, postalCode, locale]);

  const noSlots = days.length === 0;

  /* Unique per instance, so two pickers on one page cannot share a radio group. */
  const groupId = useId();

  /**
   * The day whose times are on screen — a view, not a choice.
   *
   * Kept apart from `scheduledFor` on purpose. Looking at Saturday is not the
   * same as booking Saturday, so browsing away from a slot the customer already
   * picked must not silently unpick it; the chip for that day keeps its marker
   * and the summary keeps naming it, until they tap a different time.
   */
  const [browsing, setBrowsing] = useState<string | null>(null);

  /** The day the booked slot belongs to, or null when nothing is booked yet. */
  const selectedDate =
    days.find((day) => day.slots.some((slot) => slot.value === scheduledFor))?.date ?? null;

  /*
   * Which day is open, in order of precedence: the one being browsed, the one
   * holding the booking, then the first available. Each is checked against the
   * current list rather than trusted — switching to delivery regenerates the
   * days, and the one being browsed may no longer be among them.
   */
  const activeDate =
    (browsing && days.some((day) => day.date === browsing) ? browsing : null) ??
    selectedDate ??
    days[0]?.date ??
    null;

  const activeDay = days.find((day) => day.date === activeDate) ?? null;
  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;
  const selectedSlot = selectedDay?.slots.find((slot) => slot.value === scheduledFor) ?? null;

  return (
    <fieldset className="border-0 p-0">
      <legend className="font-display text-xl font-semibold text-ink">
        {t("when")}
      </legend>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          {
            value: "asap" as const,
            label: t("asap"),
            // When the kitchen is shut, ASAP is not an option the customer can
            // take — saying "about 20 minutes" would be a promise nobody can keep.
            detail: acceptingNow ? t("asapDetail", { minutes: readyMinutes }) : t("kitchenClosed"),
          },
          {
            value: "scheduled" as const,
            label: t("scheduleLater"),
            detail: noSlots ? t("noSlots") : t("chooseTime"),
          },
        ].map((choice) => {
          const isSelected = timing === choice.value;
          const disabled =
            (choice.value === "scheduled" && noSlots) ||
            (choice.value === "asap" && !acceptingNow);
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

      {timing === "scheduled" && !noSlots && activeDay && (
        <div className="mt-5">
          {/* ── Which day ───────────────────────────────────────────────── */}
          <fieldset className="border-0 p-0">
            <legend className="text-sm font-medium text-ink">{t("whichDay")}</legend>
            {/*
              A wrapping grid rather than a scrolling strip. Six days fit in two
              rows on the narrowest phone, so nothing is hidden off the edge —
              a horizontal scroller puts later days somewhere the customer has
              to discover, and horizontal flicks fight the page's own scroll.
            */}
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {days.map((day) => {
                const isActive = day.date === activeDate;
                const holdsBooking = day.date === selectedDate;
                return (
                  <label
                    key={day.date}
                    className={`relative flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-control border px-2 py-2 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                      isActive
                        ? "border-ember bg-ember-soft"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${groupId}-day`}
                      value={day.date}
                      checked={isActive}
                      onChange={() => setBrowsing(day.date)}
                      className="sr-only"
                    />
                    {/*
                      The chip reads "Today / 28 Aug" to a sighted customer, but
                      that is two fragments to a screen reader. The whole date
                      goes in the accessible name instead.
                    */}
                    <span className="sr-only">
                      {holdsBooking && selectedSlot
                        ? t("dayBookedFor", {
                            day: day.longLabel,
                            slot: selectedSlot.label,
                          })
                        : day.longLabel}
                    </span>
                    <span aria-hidden="true" className="block text-sm font-semibold text-ink">
                      {/*
                        "Today" and "Tomorrow" are interface words and live in
                        the catalogue; anything further out is a weekday, which
                        Intl already produced in the right language.
                      */}
                      {day.offset === 0
                        ? t("today")
                        : day.offset === 1
                          ? t("tomorrow")
                          : day.longLabel.split(" ")[0]}
                    </span>
                    <span aria-hidden="true" className="block text-xs text-ink-muted">
                      {day.dateLabel}
                    </span>
                    {/* Which day holds the booking, when it is not the one on screen. */}
                    {holdsBooking && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ember"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* ── Which time ──────────────────────────────────────────────── */}
          {/*
            The error belongs to the group of times, not to any one of them —
            `aria-invalid` means nothing on a radio, and describing all forty
            with the same message would repeat it forty times.
          */}
          <fieldset
            className="mt-5 border-0 p-0"
            aria-describedby={error ? "timing-error" : undefined}
          >
            <legend className="text-sm font-medium text-ink">
              {t("whatTimeOn", { day: activeDay.longLabel })}
            </legend>
            {/*
              Four across on a phone: at 360px that is a 76px target per time,
              comfortably past the 44px a fingertip needs, with a gap between
              them so a near-miss lands on nothing rather than on 19:45.
            */}
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {activeDay.slots.map((slot) => {
                const isSelected = slot.value === scheduledFor;
                return (
                  <label
                    key={slot.value}
                    className={`flex min-h-12 cursor-pointer items-center justify-center rounded-control border text-sm tabular-nums transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                      isSelected
                        ? "border-ember bg-ember font-semibold text-on-ember"
                        : "border-line bg-surface text-ink hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${groupId}-time`}
                      value={slot.value}
                      checked={isSelected}
                      onChange={() => setScheduledFor(slot.value)}
                      className="sr-only"
                    />
                    <span className="sr-only">
                      {activeDay.longLabel} at {slot.label}
                    </span>
                    <span aria-hidden="true">{slot.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/*
            What is actually booked, spelled out. The grid shows the day being
            looked at; this is the only place that always names the day and time
            the order will carry, which matters most when they differ.
          */}
          <p
            role="status"
            className={`mt-4 rounded-control p-3 text-sm ${
              selectedSlot
                ? "bg-ember-soft font-medium text-ink"
                : "bg-surface-sunken text-ink-muted"
            }`}
          >
            {selectedSlot && selectedDay
              ? /*
                 * Three whole sentences rather than one built from clauses.
                 * English can say "Ready today at 18:15" by dropping a word
                 * into a slot; Dutch says "Vandaag klaar om 18:15", which puts
                 * the day first and the verb elsewhere. Only complete strings
                 * let a translator do that.
                 */
                selectedDay.offset === 0
                ? t("readyToday", { time: selectedSlot.label })
                : selectedDay.offset === 1
                  ? t("readyTomorrow", { time: selectedSlot.label })
                  : t("readyOn", { day: selectedDay.longLabel, time: selectedSlot.label })
              : t("pickATime")}
          </p>

          <p className="mt-2 text-xs text-ink-subtle">
            {tc("timesShownFor", { city: RESTAURANT.address.city })}
          </p>
        </div>
      )}

      {!acceptingNow && (
        <p role="status" className="mt-4 rounded-control bg-surface-sunken p-3 text-sm text-ink-muted">
          {t("closedNotice")}
        </p>
      )}

      {error && (
        <p id="timing-error" role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
