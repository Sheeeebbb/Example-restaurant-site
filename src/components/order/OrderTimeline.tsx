"use client";

import {
  statusDescription,
  statusLabel,
  timelineFor,
  timelineIndex,
} from "@/lib/order/status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";

/**
 * Order progress.
 *
 * An ordered list, because that is what it is — and a screen reader then
 * announces "3 of 5" without any ARIA. The current stage carries a word
 * ("Now"), not just a colour, so the state survives being read aloud or seen by
 * someone who can't distinguish the accent.
 */
export function OrderTimeline({
  status,
  fulfillmentType,
}: {
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  const stages = timelineFor(fulfillmentType);
  const current = timelineIndex(status, fulfillmentType);

  return (
    <ol className="space-y-0">
      {stages.map((stage, index) => {
        const done = index < current;
        const isCurrent = index === current;
        const isLast = index === stages.length - 1;

        return (
          <li key={stage} className="flex gap-4">
            {/* Marker column: dot plus the connector down to the next stage. */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  done
                    ? "border-herb bg-herb"
                    : isCurrent
                      ? "border-ember bg-ember"
                      : "border-line-strong bg-surface"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-on-herb">
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : isCurrent ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-on-ember" />
                ) : null}
              </span>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`w-0.5 flex-1 ${done ? "bg-herb" : "bg-line"}`}
                  style={{ minHeight: "2rem" }}
                />
              )}
            </div>

            <div className={isLast ? "pb-0" : "pb-6"}>
              <p
                className={`font-medium ${
                  isCurrent ? "text-ink" : done ? "text-ink-muted" : "text-ink-subtle"
                }`}
              >
                {statusLabel(stage, fulfillmentType)}
                {isCurrent && (
                  <span className="ml-2 rounded-full bg-ember-soft px-2 py-0.5 text-xs font-semibold text-ember">
                    Now
                  </span>
                )}
              </p>
              {isCurrent && (
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {statusDescription(stage, fulfillmentType)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
