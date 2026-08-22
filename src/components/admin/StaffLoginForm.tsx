"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Staff sign-in.
 *
 * The passcode is shown on screen on purpose: this is a demonstration, and a
 * hidden shared secret would only make the prototype awkward to try without
 * making it any more secure. See the warning in `lib/admin/auth.ts`.
 */
export function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
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

    // `refresh` so the proxy re-evaluates with the new cookie before we land.
    router.replace(next.startsWith("/admin") ? next : "/admin");
    router.refresh();
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
            <p id="passcode-hint" className="mt-2 text-sm text-ink-subtle">
              Demo passcode: <code className="font-medium text-ink">urbantable</code>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !passcode}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
