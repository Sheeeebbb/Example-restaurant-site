"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Confirming a cancellation.
 *
 * Cancelling is the one action on this screen that cannot be undone, so it is
 * the one action that asks twice. Nothing is sent until "Cancel this order" is
 * pressed here — opening this panel by mistake costs a keystroke, not an order.
 *
 * The reason is required, and the panel says plainly who reads it. A customer
 * whose dinner has just been called off is owed a sentence; "Cancelled" on its
 * own is the thing that makes them phone. The quick reasons cover what actually
 * goes wrong in a kitchen so the common case is one tap, and the text stays
 * editable so the uncommon case is still sayable.
 *
 * Built on `<dialog>` + `showModal()` for the focus trap, Escape handling and
 * top-layer stacking, the same as the customer-facing product panel.
 */
const QUICK_REASONS = [
  "An item is temporarily unavailable.",
  "We're unable to deliver to this address tonight.",
  "The kitchen is closing before this order could be prepared.",
  "The customer asked us to cancel.",
];

export function CancelOrderDialog({
  reference,
  statusLabel,
  onConfirm,
  onClose,
}: {
  reference: string;
  /** Where the order stands now, so staff can see what they are ending. */
  statusLabel: string;
  onConfirm: (reason: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError("Write a short reason — the customer is shown it.");
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onConfirm(text);
    setBusy(false);
    // Left open on failure: closing would throw away what they typed and leave
    // them guessing whether the order was cancelled or not.
    if (failure) setError(failure);
  };

  return (
    <dialog
      ref={dialogRef}
      /* Escape fires `cancel`, not `close`. Handling it here keeps the one
         teardown path — React's dev double-mount runs the cleanup above
         between mounts, and `onClose` would read that as the staff member
         dismissing the panel. */
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="cancel-order-heading"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <form onSubmit={submit} noValidate className="p-6">
        <h2
          id="cancel-order-heading"
          className="font-display text-xl font-semibold text-ink"
        >
          Cancel {reference}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          This order is <span className="font-medium text-ink">{statusLabel}</span>.
          Cancelling is final — it can&rsquo;t be reopened or moved on afterwards.
        </p>

        <label htmlFor="cancel-reason" className="mt-5 block text-sm font-medium text-ink">
          Reason for cancellation
        </label>
        <p id="cancel-reason-help" className="mt-1 text-xs leading-relaxed text-ink-muted">
          The customer sees this on their tracking page, word for word.
        </p>
        <textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError(null);
          }}
          maxLength={500}
          autoFocus
          aria-describedby="cancel-reason-help"
          aria-invalid={Boolean(error) || undefined}
          placeholder="We are unable to fulfil this order because…"
          className="mt-2 w-full rounded-control border border-line bg-surface p-3 text-sm leading-relaxed text-ink placeholder:text-ink-subtle"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setReason(preset);
                setError(null);
              }}
              className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-left text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              {preset}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-control bg-danger-soft p-2.5 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-control bg-danger px-5 text-sm font-semibold text-on-danger transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Cancelling…" : "Cancel this order"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50"
          >
            Keep the order
          </button>
        </div>
      </form>
    </dialog>
  );
}
