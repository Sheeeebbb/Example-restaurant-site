import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "./config";
import en from "../../messages/en.json";

/**
 * What language this request is in, and the words to render it with.
 *
 * Runs once per request on the server, so the HTML arrives already translated:
 * no flash of English, a correct `lang` attribute for screen readers, and only
 * the active locale's messages in the payload — the other language is never
 * sent to the browser at all.
 */

/**
 * Fills gaps in a translation from English, key by key.
 *
 * A missing Dutch string must never surface as `cart.checkout` or as blank
 * space on a customer's screen. This merges the English tree underneath, so an
 * untranslated key renders the English sentence — wrong language, but a real
 * sentence the customer can act on, which is the better of the two failures.
 *
 * `onError` below is what stops that being silent in development.
 */
function withFallback(
  messages: Record<string, unknown>,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...fallback };
  for (const [key, value] of Object.entries(messages)) {
    const base = fallback[key];
    merged[key] =
      value && typeof value === "object" && !Array.isArray(value) &&
      base && typeof base === "object" && !Array.isArray(base)
        ? withFallback(value as Record<string, unknown>, base as Record<string, unknown>)
        : value;
  }
  return merged;
}

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  if (locale === DEFAULT_LOCALE) return en as Record<string, unknown>;
  const translated = (await import(`../../messages/${locale}.json`)).default;
  return withFallback(translated, en as Record<string, unknown>);
}

export default getRequestConfig(async () => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    cookieStore.get("urban-table-locale")?.value,
    headerList.get("accept-language"),
  );

  return {
    locale,
    messages: await loadMessages(locale),
    /*
     * The restaurant's zone, not the visitor's.
     *
     * Every timestamp on this site is about when food is ready in Leeuwarden.
     * Formatting a pickup slot in the customer's own timezone would tell
     * someone on holiday to collect their order at a time the shop is shut.
     * Language and timezone are separate settings and this keeps them so.
     */
    timeZone: "Europe/Berlin",
    /*
     * A missing key is a bug, and in development it should look like one.
     * In production it is swallowed: the fallback above has already produced
     * English, and a thrown error would be a blank page over a missing word.
     */
    onError(error) {
      if (process.env.NODE_ENV === "development") console.warn(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join(".");
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] missing translation: ${path}`);
      }
      // Never the raw key on a customer's screen.
      return "";
    },
  };
});
