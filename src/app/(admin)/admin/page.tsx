import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/admin/StatCard";
import { listOrders } from "@/lib/order/order-repository";
import { calculateStats } from "@/lib/admin/stats";
import { deriveStatus, statusLabel } from "@/lib/order/status";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard · Staff" };

/**
 * Always rendered fresh: a cached kitchen dashboard is worse than no dashboard.
 */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const orders = await listOrders();
  const stats = calculateStats(orders);
  const recent = orders.slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Today at a glance
          </h1>
          <p className="mt-1 text-ink-muted">
            Live figures from orders placed through the site.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex min-h-10 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
        >
          Manage orders
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Orders today"
          value={String(stats.ordersToday)}
          hint={stats.ordersToday === 0 ? "Nothing yet" : "Placed since midnight"}
        />
        <StatCard
          label="Revenue today"
          value={formatMoney(stats.revenueToday)}
          hint={
            stats.ordersToday > 0
              ? `${formatMoney(stats.averageOrderValue)} average`
              : "No takings yet"
          }
          tone="herb"
        />
        <StatCard
          label="Being prepared"
          value={String(stats.preparing)}
          hint="On the pass now"
          tone="ember"
        />
        <StatCard
          label="Awaiting pickup"
          value={String(stats.awaitingPickup)}
          hint="Ready on the counter"
          tone="warning"
        />
        <StatCard
          label="Out for delivery"
          value={String(stats.outForDelivery)}
          hint="With a driver"
          tone="ember"
        />
      </div>

      <section aria-labelledby="recent-heading" className="mt-10">
        <h2 id="recent-heading" className="font-display text-xl font-semibold text-ink">
          Latest orders
        </h2>

        {recent.length === 0 ? (
          <div className="mt-4 rounded-card border border-line bg-surface p-10 text-center">
            <p className="font-medium text-ink">No orders yet</p>
            <p className="mt-2 text-sm text-ink-muted">
              Place one from the customer site and it will appear here
              immediately.
            </p>
            <Link
              href="/menu"
              className="mt-5 inline-flex min-h-10 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-sunken"
            >
              Open the customer menu
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {recent.map((order) => (
              <li key={order.reference}>
                <Link
                  href={`/admin/orders?order=${order.reference}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <span className="font-display font-semibold text-ink">
                    {order.reference}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {order.fulfillment.type === "delivery" ? "Delivery" : "Pickup"} ·{" "}
                    {order.lines.length}{" "}
                    {order.lines.length === 1 ? "item" : "items"}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {statusLabel(deriveStatus(order), order.fulfillment.type)}
                  </span>
                  <span className="font-medium tabular-nums text-ink">
                    {formatMoney(order.totals.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
