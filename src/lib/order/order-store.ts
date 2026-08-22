"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Order } from "../types";

/**
 * Orders placed in this browser session.
 *
 * WHY sessionStorage, AND WHY PERSISTED AT ALL.
 *
 * An order contains a name, phone number, email and home address, so it follows
 * the same rule as the checkout draft: it lives in sessionStorage and is gone
 * when the tab closes, rather than sitting in localStorage indefinitely.
 *
 * It has to persist somewhere, though, because the confirmation page must
 * survive a refresh — losing someone's order number because they hit reload
 * would be indefensible. sessionStorage is the narrowest thing that satisfies
 * that.
 *
 * The real fix is a backend: orders belong in a database, looked up by
 * reference, which is also what makes tracking work from a different device.
 * Until then this store is the stand-in, and `/order/track` says so plainly.
 */

interface OrderState {
  /** Keyed by reference, newest first when listed. */
  orders: Record<string, Order>;
  hasHydrated: boolean;

  saveOrder: (order: Order) => void;
  getOrder: (reference: string) => Order | null;
  setHasHydrated: (value: boolean) => void;
}

/** Keeps the store from growing without bound in a long session. */
const MAX_ORDERS = 20;

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: {},
      hasHydrated: false,

      saveOrder: (order) =>
        set((state) => {
          const next = { ...state.orders, [order.reference]: order };
          const references = Object.keys(next);
          if (references.length > MAX_ORDERS) {
            const oldest = references.sort(
              (a, b) =>
                new Date(next[a].createdAt).getTime() -
                new Date(next[b].createdAt).getTime(),
            )[0];
            delete next[oldest];
          }
          return { orders: next };
        }),

      getOrder: (reference) => get().orders[reference] ?? null,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "urban-table-orders",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({ orders: state.orders }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

/** Most recent first — for the tracking page's "your recent orders". */
export function sortOrders(orders: Record<string, Order>): Order[] {
  return Object.values(orders).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
