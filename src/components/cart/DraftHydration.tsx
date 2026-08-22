"use client";

import { useEffect } from "react";
import { useOrderDraftStore } from "@/lib/order/draft-store";

/**
 * Restores the in-progress order details after the first paint.
 * Mounted by the cart page rather than the root layout — no other page reads
 * this store, and sessionStorage should not be touched on pages that don't.
 */
export function DraftHydration() {
  useEffect(() => {
    void useOrderDraftStore.persist.rehydrate();
  }, []);

  return null;
}
