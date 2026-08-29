/**
 * Which languages the site speaks, and how it decides which one you get.
 *
 * Pure and dependency-free so it can be imported from the proxy, from server
 * components, from client components and from tests without dragging anything
 * with it.
 *
 * ── Adding a language ───────────────────────────────────────────────────────
 * Three steps, none of which touch a component:
 *   1. Add it to `LOCALES` below.
 *   2. Add `messages/<code>.json` — copy `en.json` and translate.
 *   3. Add the menu rows for it (see `menu_item_translations`).
 * Everything else — the selector, negotiation, formatting, the `lang`
 * attribute, the fallback — reads this list rather than naming languages.
 */

export const LOCALES = [
  {
    /** BCP 47, and what goes in the cookie, `<html lang>` and Intl. */
    code: "en",
    /**
     * The language's name IN that language.
     *
     * "Nederlands", never "Dutch": someone looking for their own language scans
     * for the word they use for it, and will not recognise the English one.
     */
    label: "English",
    /** For `aria-label` on the selector, in the CURRENT language. */
    englishName: "English",
  },
  {
    code: "nl",
    label: "Nederlands",
    englishName: "Dutch",
  },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const LOCALE_CODES = LOCALES.map((locale) => locale.code) as readonly Locale[];

/**
 * English, and the fallback for everything.
 *
 * Every key in `messages/en.json` is guaranteed present; other locales may be
 * incomplete and fall back to this one key by key. See `src/i18n/request.ts`.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Where an explicit choice is remembered.
 *
 * A plain cookie rather than anything clever: it is readable by the server on
 * the first request, so the page is rendered in the right language rather than
 * flipping to it after hydration. Not httpOnly — the client selector needs to
 * write it — and it carries no authority over anything, only presentation.
 */
export const LOCALE_COOKIE = "urban-table-locale";

/** A year. A language preference is not something to ask about again next week. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The BCP 47 tags used for FORMATTING, which are not the same as the UI language.
 *
 * This restaurant already made that distinction before there were two
 * languages: money was formatted `de-DE` ("12,50 €", how this market writes a
 * euro) while dates were `en-GB`, so English copy would not sprout "Samstag".
 * Choosing English keeps exactly that, unchanged.
 *
 * Dutch gets `nl-NL` for both, which is what a Dutch customer expects: "€ 12,50"
 * and "zaterdag 29 augustus".
 *
 * A new language adds one row here and inherits nothing it did not ask for.
 */
export const FORMATTING: Record<Locale, { money: string; dateTime: string }> = {
  en: { money: "de-DE", dateTime: "en-GB" },
  nl: { money: "nl-NL", dateTime: "nl-NL" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

export function localeLabel(code: Locale): string {
  return LOCALES.find((locale) => locale.code === code)?.label ?? code;
}

/**
 * The best supported language for an `Accept-Language` header.
 *
 * Used ONLY when there is no cookie — an explicit choice always wins, and
 * writing the cookie is what makes it explicit. Without this rule the site
 * would keep dragging a Dutch-browser customer back to Dutch every time they
 * chose English, which is the single most irritating thing an i18n system can
 * do.
 *
 * Quality values are honoured, so `nl;q=0.8, en;q=0.9` picks English. A
 * region subtag matches its base language: `nl-BE` is Dutch.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        tag: tag.trim().toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    if (tag === "*") return DEFAULT_LOCALE;
    const base = tag.split("-")[0];
    const match = LOCALE_CODES.find((code) => code === tag || code === base);
    if (match) return match;
  }

  return DEFAULT_LOCALE;
}

/**
 * The locale for a request: an explicit choice, then the browser, then English.
 *
 * One function so the proxy, the request config and the tests cannot disagree
 * about the order of precedence.
 */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return negotiateLocale(acceptLanguage);
}
