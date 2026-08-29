import { describe, expect, it } from "vitest";
import {
  earliestReadyTime,
  generateSlots,
  isAcceptingOrdersAt,
  isOpenAt,
  isSlotStillValid,
  leadTimeMinutes,
} from "./scheduling";
import { findZone, normalizePostalCode } from "./delivery";
import { RESTAURANT } from "../config/restaurant";

/**
 * Dates are constructed with local-time components rather than ISO strings so
 * these assertions do not shift with the machine's timezone. The restaurant's
 * hours are expressed in local minutes-past-midnight, and that is what the
 * scheduling code reads.
 */
const localDate = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0);

// 2026-08-19 is a Wednesday: open 11:30–22:00.
const WED_LUNCH = localDate(2026, 8, 19, 12, 0);
// 2026-08-17 is a Monday: closed.
const MON = localDate(2026, 8, 17, 12, 0);

describe("opening hours", () => {
  it("is open during service", () => {
    expect(isOpenAt(WED_LUNCH)).toBe(true);
  });

  it("is closed on Mondays", () => {
    expect(isOpenAt(MON)).toBe(false);
  });

  it("is closed before the doors open", () => {
    expect(isOpenAt(localDate(2026, 8, 19, 10, 0))).toBe(false);
  });

  it("stops taking orders before it stops serving", () => {
    // Closes at 22:00 with a 30-minute buffer, so 21:45 is too late to order
    // but the room is still open.
    const lateButOpen = localDate(2026, 8, 19, 21, 45);
    expect(isOpenAt(lateButOpen)).toBe(true);
    expect(isAcceptingOrdersAt(lateButOpen)).toBe(false);
  });
});

describe("lead time", () => {
  it("is prep time alone for pickup", () => {
    expect(leadTimeMinutes("pickup", null)).toBe(
      RESTAURANT.ordering.minimumPrepMinutes,
    );
  });

  it("adds travel time for delivery", () => {
    const zone = findZone("8930");
    expect(zone).not.toBeNull();
    expect(leadTimeMinutes("delivery", zone)).toBe(
      RESTAURANT.ordering.minimumPrepMinutes + zone!.estimatedMinutes,
    );
  });

  it("respects a slow item that outlasts the kitchen minimum", () => {
    expect(leadTimeMinutes("pickup", null, 45)).toBe(45);
  });

  it("pushes the earliest ready time out by the lead time", () => {
    const ready = earliestReadyTime(WED_LUNCH, "pickup", null);
    expect(ready.getTime() - WED_LUNCH.getTime()).toBe(
      RESTAURANT.ordering.minimumPrepMinutes * 60_000,
    );
  });
});

/**
 * The picker shows a day and then that day's times, so each day has to carry
 * enough to name itself. "Saturday" alone is not a date, and two Saturdays sit
 * inside the booking window's reach.
 */
describe("day labels", () => {
  it("names the calendar date as well as the day", () => {
    const days = generateSlots(WED_LUNCH, "pickup", null);
    expect(days[0].label).toBe("Today");
    expect(days[0].dateLabel).toBe("19 Aug");
    expect(days[0].longLabel).toBe("Wednesday 19 August");
  });

  it("labels every day it returns", () => {
    for (const day of generateSlots(WED_LUNCH, "pickup", null)) {
      expect(day.dateLabel, day.date).toBeTruthy();
      expect(day.longLabel, day.date).toBeTruthy();
    }
  });

  it("names the date the day's slots actually fall on", () => {
    // The label is formatted from the local Date, not re-parsed from the key:
    // `new Date("2026-08-22")` is UTC midnight, and would name the day before
    // in any negative-offset timezone.
    for (const day of generateSlots(WED_LUNCH, "pickup", null)) {
      const first = new Date(day.slots[0].value);
      const dayOfMonth = String(first.getDate());
      expect(day.longLabel, day.date).toContain(dayOfMonth);
      expect(day.dateLabel, day.date).toContain(dayOfMonth);
    }
  });

  it("gives each day in the window a distinct date", () => {
    // Two chips reading the same thing would be a coin toss for the customer.
    const days = generateSlots(WED_LUNCH, "pickup", null);
    expect(new Set(days.map((day) => day.longLabel)).size).toBe(days.length);
    expect(new Set(days.map((day) => day.date)).size).toBe(days.length);
  });
});

describe("generateSlots", () => {
  it("never offers a slot earlier than the lead time allows", () => {
    const days = generateSlots(WED_LUNCH, "pickup", null);
    const earliest = earliestReadyTime(WED_LUNCH, "pickup", null);
    const firstSlot = new Date(days[0].slots[0].value);
    expect(firstSlot.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
  });

  it("aligns slots to the configured interval", () => {
    const days = generateSlots(WED_LUNCH, "pickup", null);
    for (const slot of days[0].slots) {
      expect(new Date(slot.value).getMinutes() % RESTAURANT.ordering.slotIntervalMinutes)
        .toBe(0);
    }
  });

  it("omits days the restaurant is closed", () => {
    const days = generateSlots(localDate(2026, 8, 16, 12, 0), "pickup", null);
    // Sunday 16th is open, Monday 17th is not.
    expect(days.map((day) => day.label)).not.toContain("Tomorrow");
  });

  it("labels the first two days relatively", () => {
    const days = generateSlots(WED_LUNCH, "pickup", null);
    expect(days[0].label).toBe("Today");
  });

  it("returns no slots for today once ordering has closed", () => {
    const days = generateSlots(localDate(2026, 8, 19, 21, 50), "pickup", null);
    expect(days[0]?.label).not.toBe("Today");
  });

  it("offers fewer delivery slots than pickup slots, because travel costs time", () => {
    const zone = findZone("8940");
    const pickup = generateSlots(WED_LUNCH, "pickup", null);
    const delivery = generateSlots(WED_LUNCH, "delivery", zone);
    expect(delivery[0].slots.length).toBeLessThan(pickup[0].slots.length);
  });
});

describe("isSlotStillValid", () => {
  it("accepts a slot comfortably in the future", () => {
    const slot = localDate(2026, 8, 19, 19, 0).toISOString();
    expect(isSlotStillValid(slot, WED_LUNCH, "pickup", null)).toBe(true);
  });

  it("rejects a slot that is now inside the lead time", () => {
    const slot = localDate(2026, 8, 19, 12, 5).toISOString();
    expect(isSlotStillValid(slot, WED_LUNCH, "pickup", null)).toBe(false);
  });

  it("rejects a slot on a day the restaurant is closed", () => {
    const slot = localDate(2026, 8, 24, 19, 0).toISOString(); // Monday
    expect(isSlotStillValid(slot, WED_LUNCH, "pickup", null)).toBe(false);
  });

  it("rejects a malformed timestamp", () => {
    expect(isSlotStillValid("not-a-date", WED_LUNCH, "pickup", null)).toBe(false);
  });
});

describe("delivery zones", () => {
  it("normalizes spacing", () => {
    expect(normalizePostalCode(" 89 30 ")).toBe("8930");
  });

  it("finds the zone covering a postal code", () => {
    expect(findZone("8930")?.id).toBe("zone-local");
  });

  it("returns null outside the delivery area", () => {
    expect(findZone("9999")).toBeNull();
  });

  it("returns null for empty input rather than guessing", () => {
    expect(findZone("")).toBeNull();
  });
});
