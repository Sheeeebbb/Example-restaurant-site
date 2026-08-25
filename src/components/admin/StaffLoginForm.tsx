"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Staff sign-in.
 *
 * The demo passcode is shown on screen on purpose — a hidden shared secret
 * would make the prototype awkward to try without making it any more secure.
 * It is passed in from the server and only when the published default is still
 * in use, so a deployment that sets its own never prints it. See the warning in
 * `lib/admin/auth.ts`.
 */
export function StaffLoginForm({ demoPasscode }: { demoPasscode: string | null }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    /*
     * Say why, rather than going quiet.
     *
     * The button used to be `disabled` until this field had a value, which on a
     * touch screen is indistinguishable from a broken button: a disabled
     * control cannot be focused, shows no pressed state, and explains nothing.
     * Tapping it was reported as "Sign In does not work". It now always
     * submits, and an empty field is answered in words.
     */
    if (!passcode.trim()) {
      setError("Enter the passcode to sign in.");
      document.getElementById("passcode")?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
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
     * and cancelled the replace with it, so a correct passcode set the cookie
     * and then left the customer looking at the sign-in form for ever. Nothing
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

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <div className="rounded-card border border-line bg-surface p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Staff sign in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          This area shows customer names, phone numbers and addresses. It is
          behind a demonstration gate, not real authentication.
        </p>

        <form onSubmit={submit} noValidate className="mt-6">
          <label htmlFor="passcode" className="text-sm font-medium text-ink">
            Passcode
          </label>
          <input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="off"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "passcode-error" : "passcode-hint"}
            className={`mt-2 min-h-11 w-full rounded-control border bg-surface px-3 text-sm text-ink ${
              error ? "border-danger" : "border-line"
            }`}
          />
          {error ? (
            <p id="passcode-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : (
            demoPasscode && (
              <p id="passcode-hint" className="mt-2 text-sm text-ink-subtle">
                Demo passcode:{" "}
                <code className="font-medium text-ink">{demoPasscode}</code>
              </p>
            )
          )}

          <button
            type="submit"
            /* Only while a request is in flight — never merely because the
               field is empty. See `submit`. */
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
