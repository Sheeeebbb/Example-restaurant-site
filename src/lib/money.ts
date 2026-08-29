import type { Cents } from "./types";
import { RESTAURANT } from "./config/restaurant";
import { DEFAULT_LOCALE, FORMATTING, type Locale } from "../i18n/config";

/**
 * Every monetary operation in the app goes through this module.
 *
 * Arithmetic stays in integer cents and only becomes a string at the very edge,
 * when it is rendered. Nothing upstream of the UI should ever hold a float.
 */

/**
 * One formatter per language, built once.
 *
 * The currency never changes — the restaurant charges euros to everyone — but
 * how a euro is written does: English puts the symbol first and a point before
 * the cents (€12.50), Dutch puts a space after the symbol and a comma
 * (€ 12,50). Same number, same amount, different typography.
 *
 * `Intl` knows all of this; the alternative is hand-rolling separators per
 * language and getting Swiss apostrophes wrong the day someone adds German.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: Locale): Intl.NumberFormat {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(FORMATTING[locale].money, {
      style: "currency",
      currency: RESTAURANT.currency,
    });
    formatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * 1250 → "12,50 €" in English, "€ 12,50" in Dutch.
 *
 * English keeps the restaurant's own `de-DE` rendering, which is what it always
 * used and what this market reads. Only Dutch is new.
 *
 * The locale is presentation only. `cents` is what the order is charged, it is
 * an integer, and nothing here rounds, converts or otherwise touches it.
 */
export function formatMoney(cents: Cents, locale: Locale = DEFAULT_LOCALE): string {
  return formatterFor(locale).format(cents / 100);
}

/**
 * Formats a signed delta for option labels: "+$1.50", "−$0.50", or "" for zero.
 * Uses a real minus sign (U+2212) rather than a hyphen so it aligns with digits.
 */
export function formatDelta(cents: Cents, locale: Locale = DEFAULT_LOCALE): string {
  if (cents === 0) return "";
  const sign = cents > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(cents), locale)}`;
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

/**
 * The VAT already contained inside a gross amount.
 *
 * Where menu prices are quoted inclusive of VAT, the tax is not added to the
 * total — it is a portion of it. For a 19% rate, a 11,90 € gross price contains
 * 11,90 × 19/119 of VAT, not 11,90 × 19/100.
 */
export function vatWithin(gross: Cents, ratePercent: number): Cents {
  return Math.round((gross * ratePercent) / (100 + ratePercent));
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
