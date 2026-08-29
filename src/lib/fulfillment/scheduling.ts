import type { DeliveryZone, FulfillmentType, TimingMode } from "../types";
import { RESTAURANT, WEEKDAY_NAMES, type TimeRange } from "../config/restaurant";
import { DEFAULT_LOCALE, FORMATTING, type Locale } from "../../i18n/config";

/**
 * Opening hours, lead times, and the scheduled-order slot picker.
 *
 * Slots are generated from the restaurant's hours rather than hard-coded, so
 * changing Tuesday's closing time in the config immediately changes what a
 * customer can pick. The server must re-validate any chosen slot at checkout —
 * a customer can sit on the page long enough for their selection to go stale.
 */

const MINUTES_PER_DAY = 24 * 60;

export interface TimeSlot {
  /** ISO timestamp for the slot's start. */
  value: string;
  /** "12:45 PM" */
  label: string;
}

export interface DaySlots {
  /** "2026-08-22" */
  date: string;
  /** "Today", "Tomorrow", or "Saturday". English; see `offset` for the translated form. */
  label: string;
  /**
   * Days from today: 0 is today, 1 is tomorrow.
   *
   * The UI needs this because "Today" and "Tomorrow" are interface words, not
   * dates — they belong in the message catalogue with everything else, and a
   * component cannot recover them from a formatted string.
   */
  offset: number;
  /**
   * "29 Aug" — the calendar date on its own, to sit under `label`.
   *
   * "Today" and "Saturday" tell a customer which day they are picking but not
   * which date, and a booking is a date.
   */
  dateLabel: string;
  /**
   * "Friday 29 August" — the whole thing, for the selection summary and for
   * anyone listening to a screen reader rather than looking at a chip.
   */
  longLabel: string;
  slots: TimeSlot[];
}

export function hoursForDay(weekday: number): TimeRange | null {
  return RESTAURANT.openingHours[weekday] ?? null;
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Whether the kitchen is open at a given moment. */
export function isOpenAt(date: Date): boolean {
  const hours = hoursForDay(date.getDay());
  if (!hours) return false;
  const minutes = minutesSinceMidnight(date);
  return minutes >= hours.opens && minutes < hours.closes;
}

/** Whether we are still taking orders — closes earlier than the door does. */
export function isAcceptingOrdersAt(date: Date): boolean {
  const hours = hoursForDay(date.getDay());
  if (!hours) return false;
  const minutes = minutesSinceMidnight(date);
  const lastOrder = hours.closes - RESTAURANT.ordering.lastOrderBufferMinutes;
  return minutes >= hours.opens && minutes < lastOrder;
}

/**
 * Minimum minutes between placing an order and it being ready: kitchen prep,
 * plus travel time when the order is being delivered.
 */
export function leadTimeMinutes(
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  slowestItemMinutes = 0,
): number {
  const prep = Math.max(RESTAURANT.ordering.minimumPrepMinutes, slowestItemMinutes);
  const travel = fulfillmentType === "delivery" ? (zone?.estimatedMinutes ?? 0) : 0;
  return prep + travel;
}

/** The earliest moment an ASAP order could realistically be handed over. */
export function earliestReadyTime(
  from: Date,
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  slowestItemMinutes = 0,
): Date {
  const lead = leadTimeMinutes(fulfillmentType, zone, slowestItemMinutes);
  return new Date(from.getTime() + lead * 60_000);
}

function roundUpToInterval(date: Date, interval: number): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % interval;
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (interval - remainder));
  }
  return rounded;
}

/**
 * Times and dates, in the reader's language.
 *
 * `timeZone` is pinned to the restaurant's, not the visitor's: every timestamp
 * here is about when food is ready in the shop. A customer opening this on
 * holiday must see the shop's clock, or they will arrive at the wrong hour.
 * Language and timezone are separate settings and this keeps them so.
 */
function formatTime(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(FORMATTING[locale].dateTime, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: RESTAURANT.timeZone,
  }).format(date);
}

function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Formatted from the same local `Date` the slots were generated from.
 *
 * Deliberately not re-parsed from the "2026-08-22" key: `new Date("2026-08-22")`
 * is UTC midnight, which is the previous day in any negative-offset zone, and
 * the label would name a date the slots underneath it do not belong to.
 */
function formatDayParts(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
): { dateLabel: string; longLabel: string } {
  const tag = FORMATTING[locale].dateTime;
  return {
    dateLabel: new Intl.DateTimeFormat(tag, {
      day: "numeric",
      month: "short",
      timeZone: RESTAURANT.timeZone,
    }).format(date),
    longLabel: new Intl.DateTimeFormat(tag, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: RESTAURANT.timeZone,
    }).format(date),
  };
}

function dayLabel(date: Date, today: Date): string {
  const diff = Math.round(
    (new Date(toDateKey(date)).getTime() - new Date(toDateKey(today)).getTime()) /
      (MINUTES_PER_DAY * 60_000),
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return WEEKDAY_NAMES[date.getDay()];
}

/**
 * Bookable slots for the next `maxDaysAhead` days.
 *
 * A slot must be inside opening hours and at least one lead time from now, so
 * the list naturally empties out as the evening goes on. Days with no remaining
 * slots are omitted entirely rather than shown empty.
 */
export function generateSlots(
  now: Date,
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  slowestItemMinutes = 0,
  /** Presentation only. Which slots exist is identical in every language. */
  locale: Locale = DEFAULT_LOCALE,
): DaySlots[] {
  const { slotIntervalMinutes, maxDaysAhead, lastOrderBufferMinutes } =
    RESTAURANT.ordering;

  const earliest = earliestReadyTime(now, fulfillmentType, zone, slowestItemMinutes);
  const days: DaySlots[] = [];

  for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);

    const hours = hoursForDay(day.getDay());
    if (!hours) continue;

    const opens = new Date(day);
    opens.setMinutes(hours.opens);

    const lastSlot = new Date(day);
    lastSlot.setMinutes(hours.closes - lastOrderBufferMinutes);

    // Start from whichever is later: the door opening, or the earliest we could be ready.
    const start = roundUpToInterval(
      opens.getTime() > earliest.getTime() ? opens : earliest,
      slotIntervalMinutes,
    );

    const slots: TimeSlot[] = [];
    for (
      let cursor = new Date(start);
      cursor.getTime() <= lastSlot.getTime();
      cursor = new Date(cursor.getTime() + slotIntervalMinutes * 60_000)
    ) {
      slots.push({ value: cursor.toISOString(), label: formatTime(cursor, locale) });
    }

    if (slots.length > 0) {
      days.push({
        date: toDateKey(day),
        label: dayLabel(day, now),
        offset,
        ...formatDayParts(day, locale),
        slots,
      });
    }
  }

  return days;
}

/**
 * Re-checks a slot the customer picked earlier. Called before payment, because
 * a slot chosen ten minutes ago may no longer be far enough out.
 */
export function isSlotStillValid(
  isoSlot: string,
  now: Date,
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  slowestItemMinutes = 0,
): boolean {
  const slot = new Date(isoSlot);
  if (Number.isNaN(slot.getTime())) return false;

  const earliest = earliestReadyTime(now, fulfillmentType, zone, slowestItemMinutes);
  if (slot.getTime() < earliest.getTime()) return false;

  const hours = hoursForDay(slot.getDay());
  if (!hours) return false;

  const minutes = minutesSinceMidnight(slot);
  return (
    minutes >= hours.opens &&
    minutes <= hours.closes - RESTAURANT.ordering.lastOrderBufferMinutes
  );
}

/** The promised handover time for an order, whether ASAP or scheduled. */
export function resolveReadyTime(
  now: Date,
  timing: TimingMode,
  scheduledFor: string | undefined,
  fulfillmentType: FulfillmentType,
  zone: DeliveryZone | null,
  slowestItemMinutes = 0,
): Date {
  if (timing === "scheduled" && scheduledFor) {
    const scheduled = new Date(scheduledFor);
    if (!Number.isNaN(scheduled.getTime())) return scheduled;
  }
  return earliestReadyTime(now, fulfillmentType, zone, slowestItemMinutes);
}

/** Opening hours as display rows for the footer and the info page. */
export function openingHoursSummary(
  locale: Locale = DEFAULT_LOCALE,
): { day: string; hours: string }[] {
  /*
   * Weekday names from Intl rather than the English array, so a Dutch footer
   * says "zaterdag". Index 0 is Sunday in both, which is what makes a fixed
   * reference date safe here.
   */
  const weekday = new Intl.DateTimeFormat(FORMATTING[locale].dateTime, {
    weekday: "long",
    timeZone: RESTAURANT.timeZone,
  });
  const nameFor = (index: number) => {
    // 2024-01-07 was a Sunday; adding the index walks the week.
    const reference = new Date(Date.UTC(2024, 0, 7 + index, 12));
    return weekday.format(reference);
  };

  return WEEKDAY_NAMES.map((day, index) => {
    const range = RESTAURANT.openingHours[index];
    if (!range) return { day: nameFor(index), hours: "" };

    const format = (minutes: number) => {
      const date = new Date();
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return formatTime(date, locale);
    };

    return { day: nameFor(index), hours: `${format(range.opens)} – ${format(range.closes)}` };
  });
}
