"use client";

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { RevertStatusDialog } from "./RevertStatusDialog";
import { statusLabel, statusDescription, timelineFor } from "@/lib/order/status";
import {
  advanceAction,
  canCancel,
  isTerminalStatus,
  revertTargets,
} from "@/lib/order/transitions";
import { staffRefundNotice } from "@/lib/order/refund-copy";
import { authorizeStatusChange } from "@/lib/order/order-permissions";
import { formatMoney, formatDelta } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { Order, OrderStatus } from "@/lib/types";

/**
 * One order, in full, with the controls to move it along.
 *
 * There is exactly one progression control, and it is whatever this order can
 * do next — "Start preparing", "Mark ready", "Send out for delivery", "Mark
 * delivered", or the shorter path a collection follows instead. The
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
  onRevert,
  permissions,
  actorId,
  assigneeName,
  onClose,
}: {
  order: Order;
  status: OrderStatus;
  /** Resolves to an error message, or null when the move went through. */
  onAdvance: () => Promise<string | null>;
  onCancel: (reason: string) => Promise<string | null>;
  /** The stage staff picked, plus their note. Only ever called after confirming. */
  onRevert: (to: OrderStatus, note: string) => Promise<string | null>;
  /**
   * What this person's roles allow, and who they are.
   *
   * Every control below is drawn only if the same function the server will
   * apply says it would be allowed — `authorizeStatusChange`, asked here
   * speculatively and there decisively. A kitchen role therefore sees "Start
   * preparing" and "Mark ready" and no cancel button, not because this
   * component knows what a kitchen is, but because those are the permissions
   * on the account.
   */
  permissions: Set<string>;
  actorId: string;
  /** The driver carrying this order, if any. */
  assigneeName: string | null;
  onClose: () => void;
}) {
  const isDelivery = order.fulfillment.type === "delivery";
  const [confirming, setConfirming] = useState(false);
  /**
   * The stage staff have asked to go back to, while they are being asked
   * whether they meant it. Holding it here rather than acting on the press is
   * what makes choosing a stage and performing the move two separate events.
   */
  const [reverting, setReverting] = useState<OrderStatus | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const permissionActor = { id: actorId, permissions };
  const mayMoveTo = (to: OrderStatus) =>
    authorizeStatusChange({ order: { ...order, status }, to, actor: permissionActor })
      .allowed;

  const nextAction = advanceAction(status, order.fulfillment.type);
  /* The one forward control, and only if this person could actually take it. */
  const next = nextAction && mayMoveTo(nextAction.to) ? nextAction : null;
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
  const allStages = timelineFor(order.fulfillment.type);
  const stages = cancelled
    ? allStages.filter((stage) =>
        order.history.some((event) => event.status === stage),
      )
    : allStages;
  // Everything shown on a cancelled order is behind it; otherwise, where it is.
  const reached = cancelled ? stages.length : stages.indexOf(status);

  const refund = staffRefundNotice(order.refund);
  /** Earlier stages this order can be corrected back to. Empty once cancelled. */
  const back = revertTargets(status, order.fulfillment.type).filter(mayMoveTo);

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
        {assigneeName && (
          <p className="mt-2 inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink">
            Delivery accepted by {assigneeName}
          </p>
        )}
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
              at a time. Going back is possible, but it asks you to confirm.
            </p>
          </div>
        )}

        {!next && !finished && (
          <p className="mt-4 rounded-control bg-surface-sunken p-3 text-sm text-ink-muted">
            {nextAction
              ? `Moving this order to ${statusLabel(nextAction.to, order.fulfillment.type).toLowerCase()} isn't part of your role.`
              : "There is nothing further to do here."}
          </p>
        )}

        {/*
          Correcting a status that ran ahead of the food.

          Deliberately not shaped like the button above: small, outlined,
          under a label that says what it is for. Forward is the thing staff
          do fifty times a shift and it stays one tap; this is the thing they
          do when something has gone wrong, and it costs a confirmation.

          The stages offered come from the machine, so this cannot present a
          move the server would refuse — and pressing one opens a dialog. It
          does not move the order.
        */}
        {back.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Correct the status
            </p>
            <p className="mt-1 text-xs text-ink-subtle">
              Moves this order back. Asks you to confirm first, and the
              customer&rsquo;s tracking updates to match.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {back.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setReverting(stage);
                  }}
                  className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
                >
                  <span aria-hidden="true" className="mr-1.5 text-ink-subtle">
                    &larr;
                  </span>
                  {/* "Move back to…", not "Back to…": this card already has a
                      "Back to queue" button that navigates, and two controls
                      that read alike in a list of buttons is how the wrong one
                      gets pressed. */}
                  Move back to{" "}
                  {statusLabel(stage, order.fulfillment.type).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/*
          Separated by a rule, not just by colour: cancelling is not the
          quiet sibling of the button above, it is a different kind of act.
        */}
        {canCancel(status) && permissions.has("orders.cancel") && (
          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex min-h-11 items-center rounded-control border border-danger px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
            >
              Cancel order
            </button>
            <p className="mt-1.5 text-xs text-ink-subtle">
              Asks for a reason, which the customer is shown, and refunds the
              payment. Can&rsquo;t be undone.
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

        {/*
          The refund, on the same screen as the cancellation that caused it.

          A failed refund is the one thing on this page that asks a person to
          go and do something, so it is drawn as a warning and says so in
          words — a status word in a muted row is how an unrefunded customer
          goes unnoticed until they phone. The provider's own identifiers sit
          here too, because reconciling this against a dashboard is exactly
          the job, and nowhere else: the customer's page never sees them.
        */}
        {cancelled && permissions.has("refunds.view") && (
          <div
            className={`mt-4 rounded-control border p-3 ${
              refund.needsAttention
                ? "border-warning bg-warning-soft"
                : refund.tone === "good"
                  ? "border-herb/40 bg-herb-soft"
                  : "border-line bg-surface-sunken"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink">
                Refund
              </p>
              {refund.needsAttention && (
                <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-on-warning">
                  Action needed
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold text-ink">
              {refund.headline}
              {order.refund && order.refund.status !== "notRequired" && (
                <> · {formatMoney(order.refund.amount)}</>
              )}
            </p>
            <p role={refund.needsAttention ? "alert" : undefined} className="mt-0.5 text-sm leading-relaxed text-ink-muted">
              {refund.detail}
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-subtle">
              <div className="flex gap-1.5">
                <dt>Payment</dt>
                <dd className="break-all font-medium text-ink-muted">
                  {order.payment.reference}
                </dd>
              </div>
              {order.refund?.reference && (
                <div className="flex gap-1.5">
                  <dt>Refund</dt>
                  <dd className="break-all font-medium text-ink-muted">
                    {order.refund.reference}
                  </dd>
                </div>
              )}
              {order.refund && (
                <div className="flex gap-1.5">
                  <dt>Initiated</dt>
                  <dd className="font-medium text-ink-muted">
                    {dateTime.format(new Date(order.refund.initiatedAt))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {reverting && (
        <RevertStatusDialog
          reference={order.reference}
          from={status}
          to={reverting}
          fulfillmentType={order.fulfillment.type}
          onConfirm={async (note) => {
            const failure = await onRevert(reverting, note);
            if (!failure) setReverting(null);
            return failure;
          }}
          onClose={() => setReverting(null)}
        />
      )}

      {confirming && (
        <CancelOrderDialog
          reference={order.reference}
          statusLabel={statusLabel(status, order.fulfillment.type)}
          refundAmount={formatMoney(order.payment.amount)}
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
              {/* A correction says where it came from; a step forward doesn't
                  need to, because the entry above it already says. */}
              {event.from && (
                <span className="text-warning">
                  · moved back from{" "}
                  {statusLabel(event.from, order.fulfillment.type).toLowerCase()}
                </span>
              )}
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
