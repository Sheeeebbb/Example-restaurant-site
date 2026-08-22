import type { Cents } from "./types";
import { RESTAURANT } from "./config/restaurant";

/**
 * Every monetary operation in the app goes through this module.
 *
 * Arithmetic stays in integer cents and only becomes a string at the very edge,
 * when it is rendered. Nothing upstream of the UI should ever hold a float.
 */

const formatter = new Intl.NumberFormat(RESTAURANT.locale, {
  style: "currency",
  currency: RESTAURANT.currency,
});

/** 1234 → "$12.34" */
export function formatMoney(cents: Cents): string {
  return formatter.format(cents / 100);
}

/**
 * Formats a signed delta for option labels: "+$1.50", "−$0.50", or "" for zero.
 * Uses a real minus sign (U+2212) rather than a hyphen so it aligns with digits.
 */
export function formatDelta(cents: Cents): string {
  if (cents === 0) return "";
  const sign = cents > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(cents))}`;
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Percentage of an amount, rounded to the nearest cent.
 *
 * Rounding here rather than at display time keeps the invoice self-consistent:
 * the printed lines always add up to the printed total.
 */
export function percentOf(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100);
}

/** Guards against negative prices from an over-generous discount. */
export function clampToZero(cents: Cents): Cents {
  return Math.max(0, cents);
}

/** Parses "12.34" into 1234. Returns null for anything non-numeric. */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  return Math.round(Number(cleaned) * 100);
}
