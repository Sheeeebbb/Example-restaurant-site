"use client";

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { statusLabel, statusDescription, timelineFor } from "@/lib/order/status";
import { advanceAction, canCancel, isTerminalStatus } from "@/lib/order/transitions";
import { formatMoney, formatDelta } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { Order, OrderStatus } from "@/lib/types";

/**
 * One order, in full, with the controls to move it along.
 *
 * There is exactly one progression control, and it is whatever this order can
 * do next — "Start preparing", then "Mark ready", then "Mark delivered". The
 * earlier stages are not offered and disabled; they are not offered at all,
 * because an order cannot go back to them and a greyed-out row of the past is
 * just clutter on a kitchen screen. A strip above the button shows where the
 * order stands in its journey, so "one button" never means "no context".
 *
 * Cancelling sits apart from that: a quieter, red-edged action beneath the
 * progression, opening a confirmation that asks why. It is not the next step in
 * anything — it ends the order — so it does not sit in the same row as the step
 * that continues it.
 *
 * None of this is the rule. The rule is `lib/order/transitions.ts`, applied in
 * the repository; this component asks the same machine what to draw, so the
 * screen and the server can't drift apart.
 */
export function OrderDetail({
  order,
  status,
  onAdvance,
  onCancel,
  onClose,
}: {
  order: Order;
  status: OrderStatus;
  /** Resolves to an error message, or null when the move went through. */
  onAdvance: () => Promise<string | null>;
  onCancel: (reason: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const isDelivery = order.fulfillment.type === "delivery";
  const [confirming, setConfirming] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const next = advanceAction(status, order.fulfillment.type);
  const finished = isTerminalStatus(status);
  const cancelled = status === "cancelled";

  /*
   * The strip of stages above the button.
   *
   * A live order shows the whole journey, so the button below is visibly "the
   * next one of four". A cancelled order shows only the stages it actually
   * reached, because the rest never happened — trailing "Ready › Delivered"
   * after a cancellation reads as though the food is still coming, which is
   * precisely the contradiction this work exists to remove.
   */
  const allStages = timelineFor();
  const stages = cancelled
    ? allStages.filter((stage) =>
        order.history.some((event) => event.status === stage),
      )
    : allStages;
  // Everything shown on a cancelled order is behind it; otherwise, where it is.
  const reached = cancelled ? stages.length : stages.indexOf(status);

  const advance = async () => {
    setAdvancing(true);
    setActionError(null);
    const failure = await onAdvance();
    setAdvancing(false);
    if (failure) setActionError(failure);
  };

  const dateTime = new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl font-semibold text-ink">
              {order.reference}
            </h3>
            <StatusBadge status={status} fulfillmentType={order.fulfillment.type} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Placed {dateTime.format(new Date(order.createdAt))} ·{" "}
            {isDelivery ? "Delivery" : "Pickup"} ·{" "}
            {order.fulfillment.timing === "scheduled"
              ? `scheduled for ${dateTime.format(new Date(order.estimatedReadyAt))}`
              : `wanted by ${dateTime.format(new Date(order.estimatedReadyAt))}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-control px-2 text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink lg:hidden"
        >
          Back to queue
        </button>
      </div>

      {/* ── Status and the one thing to do next ───────────────────────── */}
      <div className="border-b border-line p-5 sm:p-6">
        <p className="text-sm font-semibold text-ink">Status</p>

        {/*
          Where the order is, at a glance. Passed stages read as done, the
          current one is named in full, and anything ahead is dim — so the
          single button below is obviously "the next one", not "the only one".
        */}
        <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Progress">
          {stages.map((stage, index) => {
            const done = reached !== -1 && index < reached;
            const isNow = stage === status;
            return (
              <li key={stage} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-ink-subtle">
                    ›
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isNow
                      ? "bg-ember text-on-ember"
                      : done
                        ? "bg-herb-soft text-herb"
                        : "bg-surface-sunken text-ink-subtle"
                  }`}
                >
                  {statusLabel(stage, order.fulfillment.type)}
                  {isNow && <span className="sr-only"> — current status</span>}
                </span>
              </li>
            );
          })}
          {cancelled && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-ink-subtle">
                ›
              </span>
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                Cancelled
                <span className="sr-only"> — current status</span>
              </span>
            </li>
          )}
        </ol>

        <p className="mt-4 font-display text-lg font-semibold text-ink">
          {statusLabel(status, order.fulfillment.type)}
        </p>
        <p role="status" className="mt-0.5 text-sm text-ink-muted">
          {finished
            ? cancelled
              ? "Cancelled. This order is closed and can't be reopened."
              : "Complete. Nothing further to do."
            : `The customer sees this now. ${statusDescription(status, order.fulfillment.type)}`}
        </p>

        {actionError && (
          <p
            role="alert"
            className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger"
          >
            {actionError}
          </p>
        )}

        {next && (
          <div className="mt-4">
            <button
              type="button"
              onClick={advance}
              disabled={advancing}
              className="inline-flex min-h-12 items-center rounded-control bg-ember px-6 text-base font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:opacity-50"
            >
              {advancing ? "Saving…" : next.label}
            </button>
            <p className="mt-1.5 text-xs text-ink-subtle">
              Moves this order to{" "}
              {statusLabel(next.to, order.fulfillment.type).toLowerCase()}. One step
              at a time, and there is no way back.
            </p>
          </div>
        )}

        {/*
          Separated by a rule, not just by colour: cancelling is not the
          quiet sibling of the button above, it is a different kind of act.
        */}
        {canCancel(status) && (
          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex min-h-11 items-center rounded-control border border-danger px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
            >
              Cancel order
            </button>
            <p className="mt-1.5 text-xs text-ink-subtle">
              Asks for a reason, which the customer is shown. Can&rsquo;t be undone.
            </p>
          </div>
        )}

        {cancelled && order.cancellationReason && (
          <div className="mt-4 rounded-control border border-danger/40 bg-danger-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-danger">
              Reason given to the customer
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink">
              {order.cancellationReason}
            </p>
          </div>
        )}
      </div>

      {confirming && (
        <CancelOrderDialog
          reference={order.reference}
          statusLabel={statusLabel(status, order.fulfillment.type)}
          onConfirm={async (reason) => {
            const failure = await onCancel(reason);
            if (!failure) setConfirming(false);
            return failure;
          }}
          onClose={() => setConfirming(false)}
        />
      )}

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        {/* ── Customer ─────────────────────────────────────────────────── */}
        <section aria-labelledby={`cust-${order.reference}`}>
          <h4 id={`cust-${order.reference}`} className="text-sm font-semibold text-ink">
            Customer
          </h4>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-ink-subtle">Name</dt>
              <dd className="text-ink">{order.customer.name}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Phone</dt>
              <dd>
                <a
                  href={`tel:${order.customer.phone.replace(/[^0-9+]/g, "")}`}
                  className="text-ink underline underline-offset-4"
                >
                  {order.customer.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Email</dt>
              <dd className="break-all text-ink">{order.customer.email}</dd>
            </div>
          </dl>

          <h4 className="mt-5 text-sm font-semibold text-ink">
            {isDelivery ? "Deliver to" : "Collection"}
          </h4>
          {isDelivery && order.fulfillment.address ? (
            <address className="mt-2 text-sm not-italic leading-relaxed text-ink-muted">
              {order.fulfillment.address.street}{" "}
              {order.fulfillment.address.houseNumber}
              <br />
              {order.fulfillment.address.postalCode}{" "}
              {order.fulfillment.address.city}
              {order.fulfillment.address.deliveryInstructions && (
                <>
                  <br />
                  <span className="font-medium text-ink">
                    {order.fulfillment.address.deliveryInstructions}
                  </span>
                </>
              )}
            </address>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              Collecting from the counter.
            </p>
          )}
        </section>

        {/* ── Items ────────────────────────────────────────────────────── */}
        <section aria-labelledby={`items-${order.reference}`}>
          <h4 id={`items-${order.reference}`} className="text-sm font-semibold text-ink">
            Items
          </h4>
          <ul className="mt-3 divide-y divide-line">
            {order.lines.map((line) => (
              <li key={line.lineId} className="py-2.5">
                <div className="flex justify-between gap-3">
                  <p className="font-medium text-ink">
                    {line.quantity} × {line.name}
                  </p>
                  <p className="shrink-0 tabular-nums text-ink">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </p>
                </div>
                {line.selections.length > 0 && (
                  <ul className="mt-1 text-sm text-ink-muted">
                    {line.selections.map((selection) => (
                      <li key={`${selection.groupId}-${selection.optionId}`}>
                        {selection.name}
                        {selection.priceDelta !== 0 && (
                          <span className="ml-1 text-ink-subtle">
                            {formatDelta(selection.priceDelta)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {line.notes && (
                  <p className="mt-1 rounded-control bg-warning-soft px-2 py-1 text-sm font-medium text-warning">
                    Note: {line.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="tabular-nums text-ink">
                {formatMoney(order.totals.subtotal)}
              </dd>
            </div>
            {order.totals.discount > 0 && (
              <div className="flex justify-between gap-3 text-herb">
                <dt>Discount ({order.promotionCode})</dt>
                <dd className="tabular-nums">
                  −{formatMoney(order.totals.discount)}
                </dd>
              </div>
            )}
            {isDelivery && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Delivery</dt>
                <dd className="tabular-nums text-ink">
                  {order.totals.deliveryFee === 0
                    ? "Free"
                    : formatMoney(order.totals.deliveryFee)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatMoney(order.totals.total)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── Audit trail ──────────────────────────────────────────────────── */}
      <div className="border-t border-line p-5 sm:p-6">
        <h4 className="text-sm font-semibold text-ink">History</h4>
        <ol className="mt-3 space-y-1.5 text-sm">
          {order.history.map((event, index) => (
            <li key={`${event.at}-${index}`} className="flex flex-wrap gap-x-2 text-ink-muted">
              <span className="tabular-nums text-ink-subtle">
                {dateTime.format(new Date(event.at))}
              </span>
              <span className="font-medium text-ink">
                {statusLabel(event.status, order.fulfillment.type)}
              </span>
              <span className="text-ink-subtle">
                {event.by === "staff" ? "· set by staff" : "· automatic"}
              </span>
              {event.note && <span className="w-full text-ink-subtle">{event.note}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
