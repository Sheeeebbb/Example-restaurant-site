"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Staff sign-in.
 *
 * A username and a password against a real account, checked server-side against
 * a scrypt digest. Neither value is kept here beyond the request that carries
 * it, and what comes back is an opaque session token in an httpOnly cookie this
 * component never sees.
 *
 * `seedHint` names the migrated manager account when its password is still the
 * old shared passcode — a first-run notice, and it disappears the moment a
 * deployment sets its own. It never prints a password that isn't already
 * published in the repository.
 */
export function StaffLoginForm({ seedHint }: { seedHint: { username: string; password: string } | null }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    /*
     * Say why, rather than going quiet.
     *
     * The button used to be `disabled` until the field had a value, which on a
     * touch screen is indistinguishable from a broken button: a disabled
     * control cannot be focused, shows no pressed state, and explains nothing.
     * Tapping it was reported as "Sign In does not work". It now always
     * submits, and an empty field is answered in words.
     */
    if (!username.trim()) {
      setError("Enter your username.");
      document.getElementById("username")?.focus();
      return;
    }
    if (!password) {
      setError("Enter your password.");
      document.getElementById("password")?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Sign in failed.");
      setSubmitting(false);
      return;
    }

    /*
     * A full navigation, not a client-side one.
     *
     * This used to be `router.replace(next)` followed by `router.refresh()`.
     * The refresh re-rendered the route we were still on — the sign-in page —
     * and cancelled the replace with it, so a correct password set the cookie
     * and then left the person looking at the sign-in form for ever. Nothing
     * announced the success, which is why it was reported as the button not
     * working.
     *
     * Assigning the location instead makes the browser ask the server again
     * from scratch, which is what an authentication boundary wants anyway: the
     * proxy re-evaluates the route with the new cookie present rather than
     * against a router cache populated while we were still signed out.
     *
     * `startsWith("/admin")` keeps `next` from being turned into an open
     * redirect — it also rules out protocol-relative targets like "//evil".
     */
    window.location.assign(next.startsWith("/admin") ? next : "/admin");
  };

  const field = "mt-2 min-h-11 w-full rounded-control border bg-surface px-3 text-sm text-ink";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <div className="rounded-card border border-line bg-surface p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Staff sign in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          This area shows customer names, phone numbers and addresses. What you
          can do inside it depends on the roles your account holds.
        </p>

        <form onSubmit={submit} noValidate className="mt-6">
          <label htmlFor="username" className="text-sm font-medium text-ink">
            Username
          </label>
          <input
            id="username"
            name="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(error) || undefined}
            className={`${field} ${error ? "border-danger" : "border-line"}`}
          />

          <label htmlFor="password" className="mt-4 block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="current-password"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "signin-error" : seedHint ? "signin-hint" : undefined}
            className={`${field} ${error ? "border-danger" : "border-line"}`}
          />

          {error ? (
            <p id="signin-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : (
            seedHint && (
              <p id="signin-hint" className="mt-3 rounded-control bg-warning-soft p-3 text-sm leading-relaxed text-ink">
                First run: sign in as{" "}
                <code className="font-medium">{seedHint.username}</code> with the
                passcode this site shipped with (
                <code className="font-medium">{seedHint.password}</code>), then
                change it and create accounts for the rest of the team.
              </p>
            )
          )}

          <button
            type="submit"
            /* Only while a request is in flight — never merely because a field
               is empty. See `submit`. */
            disabled={submitting}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
