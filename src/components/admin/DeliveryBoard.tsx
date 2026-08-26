"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { statusLabel } from "@/lib/order/status";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { DeliveryView } from "@/app/api/admin/deliveries/route";

/**
 * The driver's screen.
 *
 * Not the manager's board with things hidden — a different screen, fed by a
 * different endpoint, carrying a different shape. A driver's session can read
 * the address and the phone number for a run they are on, and cannot read the
 * order queue, the totals, the payment record or the refund state at all,
 * because `deliveries.view` does not open the endpoint those live behind.
 *
 * Two lists, because a driver has two questions: what could I take, and what am
 * I already carrying.
 */
const POLL_MS = 15_000;

export function DeliveryBoard({
  actorId,
  permissions,
}: {
  actorId: string;
  permissions: string[];
}) {
  const held = new Set(permissions);
  const canAccept = held.has("deliveries.accept");
  const canSetOut = held.has("deliveries.out_for_delivery");
  const canConfirm = held.has("deliveries.confirm_delivery");

  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mutations = useRef(0);

  const load = useCallback(async () => {
    const startedAt = mutations.current;
    try {
      const response = await fetch("/api/admin/deliveries", { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      const body = (await response.json()) as { deliveries: DeliveryView[] };
      // A poll that started before an action must not overwrite its result.
      if (mutations.current !== startedAt) return;
      setDeliveries(body.deliveries);
      setError(null);
    } catch {
      setError("Couldn't reach the delivery board.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  const act = async (reference: string, request: () => Promise<Response>) => {
    setBusy(reference);
    setError(null);
    const response = await request();
    const body = (await response.json()) as { ok: boolean; error?: string };
    mutations.current += 1;
    setBusy(null);
    if (!body.ok) {
      // "Another driver got there first" arrives here, and is the reason the
      // list refreshes immediately afterwards rather than leaving a stale row.
      setError(body.error ?? "That didn't work.");
    }
    await load();
  };

  const claim = (reference: string) =>
    act(reference, () =>
      fetch(`/api/admin/deliveries/${reference}/claim`, { method: "POST" }),
    );

  const release = (reference: string) =>
    act(reference, () =>
      fetch(`/api/admin/deliveries/${reference}/claim`, { method: "DELETE" }),
    );

  const advance = (reference: string, from: DeliveryView["status"]) =>
    act(reference, () =>
      fetch(`/api/admin/orders/${reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", from }),
      }),
    );

  const mine = deliveries.filter((delivery) => delivery.assignedStaffId === actorId);
  const available = deliveries.filter(
    (delivery) => !delivery.assignedStaffId && delivery.status === "ready",
  );
  const waiting = deliveries.filter(
    (delivery) => !delivery.assignedStaffId && delivery.status !== "ready",
  );

  const timeFormat = new Intl.DateTimeFormat(RESTAURANT.dateLocale, {
    hour: "numeric",
    minute: "2-digit",
  });

  const card = (delivery: DeliveryView, own: boolean) => (
    <li key={delivery.reference} className="rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              {delivery.reference}
            </h3>
            <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink">
              {statusLabel(delivery.status, "delivery")}
            </span>
            <span className="text-xs text-ink-subtle">
              {delivery.itemCount} item{delivery.itemCount === 1 ? "" : "s"} · wanted by{" "}
              {timeFormat.format(new Date(delivery.estimatedReadyAt))}
            </span>
          </div>

          <address className="mt-2 text-sm not-italic leading-relaxed text-ink">
            {delivery.customerName}
            <br />
            {delivery.address?.street} {delivery.address?.houseNumber}
            <br />
            {delivery.address?.postalCode} {delivery.address?.city}
            {delivery.address?.deliveryInstructions && (
              <>
                <br />
                <span className="font-medium">{delivery.address.deliveryInstructions}</span>
              </>
            )}
          </address>
          <a
            href={`tel:${delivery.customerPhone.replace(/[^0-9+]/g, "")}`}
            className="mt-1 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4"
          >
            {delivery.customerPhone}
          </a>
          {!own && delivery.assignedStaffName && (
            <p className="mt-1 text-sm text-ink-muted">
              With {delivery.assignedStaffName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {!own && !delivery.assignedStaffId && canAccept && delivery.status === "ready" && (
            <button
              type="button"
              onClick={() => claim(delivery.reference)}
              disabled={busy === delivery.reference}
              className="inline-flex min-h-12 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember disabled:opacity-50"
            >
              {busy === delivery.reference ? "…" : "Accept delivery"}
            </button>
          )}
          {own && delivery.status === "ready" && canSetOut && (
            <button
              type="button"
              onClick={() => advance(delivery.reference, delivery.status)}
              disabled={busy === delivery.reference}
              className="inline-flex min-h-12 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember disabled:opacity-50"
            >
              Set out for delivery
            </button>
          )}
          {own && delivery.status === "outForDelivery" && canConfirm && (
            <button
              type="button"
              onClick={() => advance(delivery.reference, delivery.status)}
              disabled={busy === delivery.reference}
              className="inline-flex min-h-12 items-center rounded-control bg-herb px-4 text-sm font-semibold text-on-herb disabled:opacity-50"
            >
              Confirm delivered
            </button>
          )}
          {own && canAccept && delivery.status === "ready" && (
            <button
              type="button"
              onClick={() => release(delivery.reference)}
              disabled={busy === delivery.reference}
              className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-sm font-medium text-ink-muted disabled:opacity-50"
            >
              Hand back
            </button>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Deliveries
      </h1>
      <p className="mt-1 text-ink-muted">
        Accept a run and it is yours — nobody else can take it.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <section className="mt-8" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Yours ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Nothing assigned to you right now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">{mine.map((delivery) => card(delivery, true))}</ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="available-heading">
        <h2 id="available-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Ready to go ({available.length})
        </h2>
        {loading ? (
          <p role="status" className="mt-2 text-sm text-ink-muted">
            Loading…
          </p>
        ) : available.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Nothing waiting for a driver.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {available.map((delivery) => card(delivery, false))}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="mt-8" aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
            Still in the kitchen ({waiting.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {waiting.map((delivery) => card(delivery, false))}
          </ul>
        </section>
      )}
    </div>
  );
}
