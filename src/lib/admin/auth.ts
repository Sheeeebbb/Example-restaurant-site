/**
 * The staff session cookie, and nothing else.
 *
 * This file used to BE the authentication: a shared passcode and a cookie whose
 * value was a constant, forgeable by anyone who read the source. That is gone.
 * Real accounts, scrypt-hashed passwords, server-side sessions and role-based
 * permissions now live in `lib/staff/`, and this is what is left — the name of
 * the cookie and the rule for marking it `Secure`, both needed in places that
 * have no business importing the whole staff system.
 *
 * The old shared passcode was not discarded. On first boot it becomes the first
 * password of a migrated manager account, so whoever had access before this
 * change still has it. See migration 1 in `lib/staff/staff-repository.ts`.
 */

export const STAFF_COOKIE = "urban-table-staff";

/**
 * The shape of a session token, for code that cannot reach the store.
 *
 * `proxy.ts` runs before the application and cannot look a token up — it uses
 * this to tell "no cookie at all" from "something that could be a session", so
 * it can redirect a signed-out person to the sign-in page. It decides nothing.
 * A string of the right shape is not a session; only `staffForToken` can say
 * that, and every protected route asks it.
 */
export function looksLikeSessionToken(value: string | undefined): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/**
 * Whether the session cookie should be marked `Secure`.
 *
 * Derived from the connection the request actually arrived on rather than from
 * `NODE_ENV`, because those are different questions. `Secure` means "only ever
 * send this back over HTTPS", so it belongs on a cookie issued over HTTPS —
 * which is every real deployment of this site, whether or not it was built with
 * `next build`.
 *
 * Tying it to `NODE_ENV === "production"` instead used to break one real case:
 * a production build served over plain HTTP from a LAN address, which is how
 * anyone checks the built site on a phone before shipping it. The browser
 * refuses a `Secure` cookie from a non-HTTPS address that isn't localhost, so
 * the sign-in POST succeeded, the cookie was dropped, and the staff member
 * landed back on the sign-in screen with no error to explain it. Nothing is
 * given up by omitting the flag there: `Secure` protects a cookie from leaking
 * over a plaintext connection, and that connection is already plaintext — the
 * password crossed it a moment earlier.
 *
 * `x-forwarded-proto` is read first because a deployment behind a load balancer
 * or a CDN terminates TLS at the edge and speaks HTTP to the application, so the
 * request URL alone would read as insecure. Only a proxy should be setting that
 * header, but if a client forges it the effect is a cookie marked `Secure` on a
 * plaintext connection — which the browser then throws away. It can lock
 * someone out; it cannot leak anything.
 */
export function shouldUseSecureCookie(request: Request): boolean {
  const forwarded = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim()
    .toLowerCase();
  if (forwarded) return forwarded === "https";

  return new URL(request.url).protocol === "https:";
}
