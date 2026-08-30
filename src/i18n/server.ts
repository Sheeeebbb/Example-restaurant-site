import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  resolveLocale,
  type Locale,
} from "./config";
import { messagesFor } from "./messages";
import type { Messages } from "./messages";

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

/**
 * The request's language and a translator for it, for route handlers.
 *
 * Reads the cookie and `Accept-Language` directly rather than going through
 * `getLocale`, which needs React's server context: a route handler has none
 * under test, and a checkout that cannot be tested is not worth having. Falls
 * back to English if there is no request at all.
 */
export async function requestMessages(): Promise<{ locale: Locale; t: Messages }> {
  try {
    const [cookieStore, headerList] = [await cookies(), await headers()];
    const locale = resolveLocale(
      cookieStore.get(LOCALE_COOKIE)?.value,
      headerList.get("accept-language") ?? undefined,
    );
    return { locale, t: messagesFor(locale) };
  } catch {
    return { locale: DEFAULT_LOCALE, t: messagesFor(DEFAULT_LOCALE) };
  }
}
