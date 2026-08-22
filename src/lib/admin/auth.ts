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
