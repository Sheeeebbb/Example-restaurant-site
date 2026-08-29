import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * The request's language, for server code that is not a component.
 *
 * The menu repository needs it to pick a translation, and it is called from
 * route handlers and server components alike. Outside a request — a seed
 * script, a test, a CLI — there is no locale to have, so this answers English
 * rather than throwing: the caller wanted words, and English is the fallback
 * everywhere else too.
 */
export async function activeLocale(): Promise<Locale> {
  try {
    const locale = await getLocale();
    return isLocale(locale) ? locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
