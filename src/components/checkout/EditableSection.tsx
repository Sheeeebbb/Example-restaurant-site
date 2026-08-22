"use client";

import { useId, type ReactNode } from "react";

/**
 * A checkout section that reads as a summary until you need to change it.
 *
 * Checkout has to *display* the customer's details, order type, timing and
 * address — but rendering four full forms makes a page nobody wants to read.
 * Collapsed summaries keep it scannable; the same form components appear
 * inline on Edit, so there is one implementation of each, not a read-only copy
 * and an editable copy that can drift apart.
 */
export function EditableSection({
  title,
  summary,
  open,
  onToggle,
  invalid,
  children,
}: {
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  invalid?: boolean;
  children: ReactNode;
}) {
  const contentId = useId();

  return (
    <section
      className={`rounded-card border bg-surface p-5 sm:p-6 ${
        invalid ? "border-danger" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="min-h-9 rounded-control px-2 text-sm font-medium text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
        >
          {open ? "Done" : "Edit"}
          <span className="sr-only"> {title}</span>
        </button>
      </div>

      {!open && <div className="mt-2 text-sm text-ink-muted">{summary}</div>}

      <div id={contentId} hidden={!open} className="mt-5">
        {children}
      </div>
    </section>
  );
}
