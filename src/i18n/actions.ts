"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "./config";

/**
 * Remembers an explicit language choice.
 *
 * A server action rather than `document.cookie` in the browser, for three
 * reasons: the value is validated against the supported list before it is
 * stored, the cookie can be written `httpOnly:false` but with proper flags in
 * one place, and the response that carries it is the same one that re-renders
 * the page — so the words change in a single round trip rather than a write
 * followed by a refetch.
 *
 * Nothing here carries authority. The cookie decides which words are shown and
 * nothing else: not prices, not the delivery area, not what is in the cart, not
 * who is signed in.
 */
export async function setLocale(next: string): Promise<void> {
  // An unknown value is ignored rather than stored. Whatever is in the cookie
  // reaches `<html lang>` and `Intl`, and neither should take a raw string
  // from a request body.
  if (!isLocale(next)) return;

  (await cookies()).set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Not httpOnly: no secret, and a future client-side read is legitimate.
    httpOnly: false,
    // Only where the page already is. A dev server on http://192.168.x.x would
    // silently drop a Secure cookie and the selector would look broken.
    secure: process.env.NODE_ENV === "production",
  });

  /*
   * Every page renders words, so every page is stale after this. `layout`
   * scope re-renders the shell — header, footer and the current page — which
   * is what makes the whole document change language at once.
   */
  revalidatePath("/", "layout");
}
