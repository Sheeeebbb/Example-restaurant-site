/**
 * MOCK STAFF AUTHENTICATION.
 *
 * ⚠️  THIS IS NOT SECURE AND IS NOT INTENDED TO BE. It exists so the admin area
 * has a real gate in a real place — one that genuinely blocks access, so the
 * shape of the app is right — while making no claim to protect anything.
 *
 * What it actually does: compares a shared passcode, then sets a cookie whose
 * value is a constant. Anyone who can read this file can forge that cookie.
 * There is no user identity, no roles, no expiry beyond the cookie's, no
 * session revocation, and no rate limiting.
 *
 * ── What replacing it looks like ────────────────────────────────────────────
 * Every check funnels through `hasStaffSession()`, and every protected route is
 * matched in `proxy.ts`. A real implementation swaps this file for a session
 * library (per-user accounts, hashed credentials, signed and rotated session
 * tokens, an idle timeout) and adds a role check where the comment below marks
 * it. No route handler or page changes, because none of them do the check
 * themselves.
 *
 * Until that happens, this admin area must not be deployed anywhere public with
 * real customer data behind it.
 */

export const STAFF_COOKIE = "urban-table-staff";

/** A constant, not a token. Forgeable by design — see the warning above. */
const SESSION_VALUE = "staff-demo-session";

/**
 * The shared passcode. Overridable so a deployment isn't stuck with the
 * published default, but a shared secret is not authentication either way.
 */
export function staffPasscode(): string {
  return process.env.ADMIN_PASSCODE ?? "urbantable";
}

export function isValidPasscode(input: string): boolean {
  return input.trim() === staffPasscode();
}

export function sessionCookieValue(): string {
  return SESSION_VALUE;
}

/**
 * The single authorisation check in the application.
 *
 * A real version resolves a user from the session and checks their role here —
 * `return user?.roles.includes("staff") ?? false`.
 */
export function isValidSession(cookieValue: string | undefined): boolean {
  return cookieValue === SESSION_VALUE;
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
 * passcode crossed it a moment earlier.
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
