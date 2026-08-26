"use client";

import { useEffect, useRef, useState } from "react";
import { revertWarning } from "@/lib/order/status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";

/**
 * The confirmation in front of moving an order backwards.
 *
 * Opening this dialog changes nothing. Choosing a stage on the panel behind it
 * changes nothing. The order moves when — and only when — "Confirm change" is
 * pressed, and dismissing by any route (Cancel, Escape, the backdrop) sends no
 * request at all. That separation is the whole point of the screen: a
 * correction should be something a person decided to do, not something that
 * happened because a thumb landed on the wrong row.
 *
 * The two buttons are deliberately unequal. "Confirm change" is the filled,
 * warning-toned one and says what it does; "Cancel" is the plain one and is
 * where focus starts, so the reflex press is the harmless one.
 *
 * A note is optional. Cancelling demands a reason because the customer reads
 * it; a correction is usually "wrong button" and making someone type that
 * before they can fix a mistake is how a kitchen learns to leave the mistake.
 */
const QUICK_NOTES = [
  "Marked by mistake.",
  "The food went back to the kitchen.",
  "The driver hasn't left yet.",
];

export function RevertStatusDialog({
  reference,
  from,
  to,
  fulfillmentType,
  onConfirm,
  onClose,
}: {
  reference: string;
  /** Where the order is now — sent back with the request as `from`. */
  from: OrderStatus;
  /** The earlier stage staff picked. */
  to: OrderStatus;
  fulfillmentType: FulfillmentType;
  /** Resolves to an error message, or null when the move went through. */
  onConfirm: (note: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warning = revertWarning(from, to, fulfillmentType);
  const finished = from === "completed";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    /*
     * Focus the harmless button, not the text field.
     *
     * `showModal()` otherwise lands on the first focusable descendant, which is
     * the note input — and on a phone that opens the keyboard over the two
     * buttons this dialog exists to offer. Done here rather than with
     * `autoFocus` because React applies that during commit, before this effect
     * runs, so `showModal()` would take the focus straight back.
     */
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await onConfirm(note.trim());
    setBusy(false);
    // Left open on failure — most often because someone else moved the order
    // while this was on screen, which is exactly when staff need to read
    // something rather than find the dialog gone.
    if (failure) setError(failure);
  };

  return (
    <dialog
      ref={dialogRef}
      /* Escape fires `cancel`, not `close`. Handling it here keeps one teardown
         path, and — like the Cancel button — it sends nothing. */
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="revert-status-heading"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <form onSubmit={submit} noValidate className="p-6">
        <h2
          id="revert-status-heading"
          className="font-display text-xl font-semibold text-ink"
        >
          {warning.title}
        </h2>

        <p className="mt-2 leading-relaxed text-ink">{warning.detail}</p>
        <p
          className={`mt-2 rounded-control p-3 text-sm leading-relaxed ${
            finished
              ? "bg-warning-soft font-medium text-ink"
              : "text-ink-muted"
          }`}
        >
          {warning.consequence}
        </p>

        <label htmlFor="revert-note" className="mt-5 block text-sm font-medium text-ink">
          Note <span className="font-normal text-ink-subtle">(optional)</span>
        </label>
        <p id="revert-note-help" className="mt-1 text-xs leading-relaxed text-ink-muted">
          Kept on {reference}&rsquo;s history for the kitchen. The customer
          doesn&rsquo;t see it.
        </p>
        <input
          id="revert-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            if (error) setError(null);
          }}
          maxLength={500}
          aria-describedby="revert-note-help"
          placeholder="Why is this being changed back?"
          className="mt-2 w-full rounded-control border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-subtle"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_NOTES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setNote(preset);
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

        <div className="mt-6 flex flex-wrap-reverse justify-end gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-control bg-warning px-4 text-sm font-semibold text-on-warning transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Changing…" : "Confirm change"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
