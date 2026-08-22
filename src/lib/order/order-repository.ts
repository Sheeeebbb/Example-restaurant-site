import type { Order, OrderStatus } from "../types";
import { getStore } from "../server/store";

/**
 * Order persistence.
 *
 * SERVER ONLY, and async throughout even though it currently resolves from a
 * Map — the same rule the menu repository follows. Swapping in a database
 * changes these function bodies and nothing that calls them.
 *
 * This is what lets the customer's order and the kitchen's order be the same
 * order. Before it existed, orders lived only in the customer's browser tab,
 * so staff could never have seen one.
 */

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function saveOrder(order: Order): Promise<Order> {
  getStore().orders.set(order.reference, clone(order));
  return clone(order);
}

export async function getOrder(reference: string): Promise<Order | null> {
  const found = getStore().orders.get(reference);
  return found ? clone(found) : null;
}

/** Newest first — the order a kitchen wants to see a queue in. */
export async function listOrders(): Promise<Order[]> {
  return clone(
    [...getStore().orders.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
}

/**
 * Records a staff status change.
 *
 * The `by: "staff"` marker on the history entry matters beyond the audit trail:
 * it tells the customer-facing tracker to stop simulating progress from the
 * clock and show what the kitchen actually said. See `lib/order/status.ts`.
 */
export async function updateOrderStatus(
  reference: string,
  status: OrderStatus,
  note?: string,
): Promise<Order | null> {
  const store = getStore();
  const existing = store.orders.get(reference);
  if (!existing) return null;

  const updated: Order = {
    ...existing,
    status,
    history: [
      ...existing.history,
      { status, at: new Date().toISOString(), note, by: "staff" },
    ],
  };

  store.orders.set(reference, updated);
  return clone(updated);
}
