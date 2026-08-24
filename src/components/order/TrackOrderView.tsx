"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { useOrderStore, sortOrders } from "@/lib/order/order-store";
import { deriveStatus, statusLabel } from "@/lib/order/status";
import {
  isValidReferenceShape,
  normalizeOrderReference,
} from "@/lib/order/reference";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { OrderStatus } from "@/lib/types";

/**
 * Order lookup.
 *
 * Orders live in this tab's sessionStorage, so this can only find orders placed
 * in the same tab — and the page says so rather than leaving someone to wonder
 * why their reference "doesn't work". Cross-device tracking needs the orders in
 * a database, which is the backend stage.
 */
export function TrackOrderView() {
  const router = useRouter();
  const orders = useOrderStore((state) => state.orders);
  const hasHydrated = useOrderStore((state) => state.hasHydrated);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  /**
   * What the kitchen says about each order listed below.
   *
   * The copies in this tab were written when the orders were placed, so their
   * status can only ever be a guess from the clock — and on an order the
   * restaurant has since cancelled, that guess is actively wrong. This list
   * would cheerfully say "Delivered" beside an order that never left. So each
   * one is checked against the server, once, on load.
   *
   * Same public endpoint the tracking page uses: it returns a status and
   * nothing else, so listing these costs no privacy.
   */
  const [live, setLive] = useState<Record<string, OrderStatus>>({});

  useEffect(() => {
    void useOrderStore.persist.rehydrate();
  }, []);

  const recent = sortOrders(orders);
  const references = recent.map((order) => order.reference).join(",");

  useEffect(() => {
    if (!references) return;
    let cancelled = false;

    void (async () => {
      const entries = await Promise.all(
        references.split(",").map(async (reference) => {
          try {
            const response = await fetch(`/api/orders/${reference}/status`, {
              cache: "no-store",
            });
            if (!response.ok) return null;
            const body = (await response.json()) as { status: OrderStatus };
            return [reference, body.status] as const;
          } catch {
            // Offline, or the order predates a server restart. Falling back to
            // the simulated status is fine — it is what this list showed
            // before, and a missing row would be worse than a stale one.
            return null;
          }
        }),
      );
      if (!cancelled) {
        setLive(Object.fromEntries(entries.filter((entry) => entry !== null)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [references]);

  const lookup = (event: React.FormEvent) => {
    event.preventDefault();
    const reference = normalizeOrderReference(input);

    if (!isValidReferenceShape(reference)) {
      setError("Order numbers look like UT-4K7PQ.");
      return;
    }
    if (!orders[reference]) {
      setError(`We can't find ${reference} in this browser.`);
      return;
    }
    router.push(`/order/${reference}`);
  };

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Track your order
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-muted">
          Enter the order number from your confirmation.
        </p>

        <form onSubmit={lookup} noValidate className="mt-6">
          <label htmlFor="reference" className="text-sm font-medium text-ink">
            Order number
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="reference"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError(null);
              }}
              placeholder="UT-4K7PQ"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "reference-error" : undefined}
              className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-sm uppercase text-ink placeholder:text-ink-subtle"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="min-h-11 shrink-0 rounded-control bg-ember px-5 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Find order
            </button>
          </div>
          {error && (
            <p id="reference-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </form>

        {hasHydrated && recent.length > 0 && (
          <section aria-labelledby="recent-heading" className="mt-12">
            <h2 id="recent-heading" className="font-display text-xl font-semibold text-ink">
              This tab&rsquo;s orders
            </h2>
            <ul className="mt-4 space-y-3">
              {recent.map((order) => (
                <li key={order.reference}>
                  <Link
                    href={`/order/${order.reference}`}
                    className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                  >
                    <span>
                      <span className="block font-display font-semibold text-ink">
                        {order.reference}
                      </span>
                      <span className="text-sm text-ink-muted">
                        {statusLabel(
                          live[order.reference] ?? deriveStatus(order),
                          order.fulfillment.type,
                        )}{" "}
                        ·{" "}
                        {order.lines.length}{" "}
                        {order.lines.length === 1 ? "item" : "items"}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-ink">
                      {formatMoney(order.totals.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 rounded-card border border-line bg-surface-sunken p-5 text-sm leading-relaxed text-ink-muted">
          Orders in this demonstration are stored in your browser tab only, so a
          reference from another device or a closed tab won&rsquo;t be found
          here. A real deployment would look orders up in a database. If
          you&rsquo;re stuck on a live order, call us on{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href={`tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`}
          >
            {RESTAURANT.contact.phone}
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
