"use client";

import { StatusBadge } from "./StatusBadge";
import { statusLabel, timelineFor } from "@/lib/order/status";
import { formatMoney, formatDelta } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { Order, OrderStatus } from "@/lib/types";

/**
 * One order, in full, with the controls to move it along.
 *
 * The status buttons offer the stages this order can actually be in: the
 * timeline for its fulfilment type, so "Out for delivery" never appears on a
 * pickup order, plus Cancelled. Staff can jump to any of them rather than being
 * forced through in sequence — kitchens skip steps, and a UI that refuses to
 * believe that gets worked around instead of used.
 */
export function OrderDetail({
  order,
  status,
  onStatusChange,
  onClose,
}: {
  order: Order;
  status: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  onClose: () => void;
}) {
  const isDelivery = order.fulfillment.type === "delivery";
  const choices: OrderStatus[] = [...timelineFor(order.fulfillment.type), "cancelled"];

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
          className="min-h-9 rounded-control px-2 text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink lg:hidden"
        >
          Back to queue
        </button>
      </div>

      {/* ── Status controls ────────────────────────────────────────────── */}
      <div className="border-b border-line p-5 sm:p-6">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Set status</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {choices.map((choice) => {
              const isCurrent = choice === status;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onStatusChange(choice)}
                  aria-pressed={isCurrent}
                  className={`min-h-10 rounded-control border px-3 text-sm font-medium transition-colors ${
                    isCurrent
                      ? "border-ember bg-ember text-on-ember"
                      : choice === "cancelled"
                        ? "border-line-strong bg-surface text-danger hover:bg-danger-soft"
                        : "border-line-strong bg-surface text-ink hover:bg-surface-sunken"
                  }`}
                >
                  {statusLabel(choice, order.fulfillment.type)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p role="status" className="mt-3 text-sm text-ink-muted">
          Customer currently sees:{" "}
          <span className="font-medium text-ink">
            {statusLabel(status, order.fulfillment.type)}
          </span>
        </p>
      </div>

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
