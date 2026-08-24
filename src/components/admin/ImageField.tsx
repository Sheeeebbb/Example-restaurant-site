"use client";

import { useEffect, useRef, useState } from "react";
import {
  describeImageRules,
  formatBytes,
  IMAGE_RULES,
  validateImageFile,
} from "@/lib/media/image-validation";

/**
 * Choosing a dish's photograph.
 *
 * Three states, and the difference between them is the whole point:
 *
 *   • the photograph the dish has now, which stays untouched until a save;
 *   • a chosen file, previewed locally and not yet uploaded anywhere;
 *   • an uploaded photograph, which the form will save with the dish.
 *
 * Cancelling at any point puts the first one back. Nothing is written to the
 * menu until the dish itself is saved, so a staff member who changes their mind
 * halfway through has changed nothing.
 *
 * The file is checked here before it is sent — type, size, and that it is a
 * file at all. The route handler checks it again, including the first bytes of
 * the file itself, because a browser's opinion of a file is only an opinion.
 */
export function ImageField({
  currentSrc,
  dishName,
  uploadedSrc,
  onUploaded,
  onCleared,
}: {
  /** What the dish looks like now. Null for a dish that has no photograph yet. */
  currentSrc: string | null;
  dishName: string;
  /** The uploaded replacement, once there is one. */
  uploadedSrc: string | null;
  onUploaded: (src: string) => void;
  onCleared: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);

  // Object URLs are a resource, not a string; letting them pile up leaks the
  // file's memory for as long as the page is open.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPending(null);
    setDimensions(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;

    const problem = validateImageFile(file);
    if (problem) {
      // Say what was wrong and keep the existing photograph. Silently ignoring
      // the file would leave staff staring at an unchanged form.
      reset();
      setError(problem);
      return;
    }

    /*
     * Then check it is really an image by decoding it. A file's type comes from
     * its extension, so a text file renamed `.jpg` gets this far — without this
     * it would preview as a broken picture and only be refused after an upload.
     * The server repeats the check on the bytes; this one is about telling
     * staff straight away.
     */
    const url = URL.createObjectURL(file);
    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
      probe.onerror = () => resolve(null);
      probe.src = url;
    });

    if (!size) {
      URL.revokeObjectURL(url);
      reset();
      setError("That file isn't a readable image. Check it opens, then choose it again.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setPending(file);
    setDimensions(size);
    setPreviewUrl(url);
  };

  const upload = async () => {
    if (!pending) return;
    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append("file", pending);
    body.append("hint", dishName || pending.name);

    try {
      const response = await fetch("/api/admin/menu/image", { method: "POST", body });
      const result = (await response.json()) as
        | { ok: true; image: { url: string }; storage: { name: string; durable: boolean } }
        | { ok: false; error: string };

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onUploaded(result.image.url);
      setStorageNote(
        result.storage.durable
          ? null
          : `Stored in ${result.storage.name} — it will be lost when the server restarts.`,
      );
      reset();
    } catch {
      setError("The upload didn't reach the server. Check the connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const advice = (() => {
    if (!dimensions) return null;
    const notes: string[] = [];
    if (dimensions.width < IMAGE_RULES.minimumWidth) {
      notes.push(
        `It is ${dimensions.width}px wide; ${IMAGE_RULES.minimumWidth}px or more stays sharp on a large screen.`,
      );
    }
    // 4:3 is 1.333…; anything within a couple of percent crops invisibly.
    const ratio = dimensions.width / dimensions.height;
    if (Math.abs(ratio - 4 / 3) > 0.03) {
      notes.push(
        `It is not ${IMAGE_RULES.aspectRatio}, so the menu will crop it to fit rather than stretch it.`,
      );
    }
    return notes.length ? notes.join(" ") : null;
  })();

  /* Which picture the panel is showing, and what it means. */
  const shown = previewUrl ?? uploadedSrc ?? currentSrc;
  const caption = previewUrl
    ? "Not saved yet — confirm to upload it"
    : uploadedSrc
      ? "Uploaded · saves with the dish"
      : currentSrc
        ? "Current photograph"
        : "No photograph yet — the menu shows a designed tile instead";

  return (
    <div className="rounded-control border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start gap-4">
        {/*
          A fixed 4:3 frame at the house ratio, with `object-contain` so a
          wrongly-shaped file is shown wrongly-shaped rather than stretched to
          fit. Staff should see the crop problem here, not discover it on the
          menu. A plain <img> rather than next/image: the source is a blob URL
          half the time, which the optimiser cannot fetch.
        */}
        <div className="relative aspect-[4/3] w-40 shrink-0 overflow-hidden rounded-control border border-line bg-surface-sunken">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt={shown === currentSrc ? `Current photograph of ${dishName}` : "Preview"}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-ink-subtle">
              No photograph
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{caption}</p>
          {pending && (
            <p className="mt-0.5 text-xs text-ink-subtle">
              {pending.name} · {formatBytes(pending.size)}
              {dimensions ? ` · ${dimensions.width}×${dimensions.height}` : ""}
            </p>
          )}

          {/*
            Advice, not a refusal. A photograph below the recommended width or
            off the house ratio is still usable — it will be cropped to fit, not
            stretched — and staff are better told than overruled.
          */}
          {advice && (
            <p className="mt-1.5 rounded-control bg-surface-sunken px-2 py-1.5 text-xs leading-relaxed text-ink-muted">
              {advice}
            </p>
          )}

          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {describeImageRules()}. Shoot the dish square-on or slightly above,
            filling about two thirds of the frame.
          </p>

          <input
            ref={inputRef}
            id="dish-image"
            type="file"
            accept={IMAGE_RULES.types.join(",")}
            onChange={(event) => choose(event.target.files?.[0])}
            className="sr-only"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {!pending && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex min-h-10 items-center rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
              >
                {currentSrc || uploadedSrc ? "Change image" : "Add image"}
              </button>
            )}

            {pending && (
              <>
                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading}
                  className="inline-flex min-h-10 items-center rounded-control bg-ember px-3 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Use this image"}
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex min-h-10 items-center rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
                >
                  Pick another
                </button>
                {/* The form has its own "Cancel", which abandons the whole
                    edit. Both read "Cancel" on screen, where the context makes
                    them obvious; the qualifier keeps them apart for anyone
                    hearing the page rather than seeing it. */}
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  Cancel<span className="sr-only"> this image and keep the current one</span>
                </button>
              </>
            )}

            {/* Undo an upload before the dish is saved, back to the original. */}
            {!pending && uploadedSrc && (
              <button
                type="button"
                onClick={() => {
                  onCleared();
                  setStorageNote(null);
                }}
                className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-medium text-ink-muted transition-colors hover:text-danger"
              >
                Keep the old one
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-control bg-danger-soft p-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {storageNote && (
        <p className="mt-3 rounded-control bg-surface-sunken p-2.5 text-xs leading-relaxed text-ink-muted">
          {storageNote}
        </p>
      )}
    </div>
  );
}
