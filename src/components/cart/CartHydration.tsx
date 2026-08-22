"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/store";

/**
 * Restores the persisted cart after the first paint.
 *
 * The store is configured with `skipHydration`, so localStorage is read here —
 * inside an effect that only runs on the client — rather than during module
 * evaluation. That guarantees the first client render matches the server HTML,
 * and the cart appears a tick later once React has taken over.
 *
 * Renders nothing; it exists purely for the effect.
 */
export function CartHydration() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return null;
}
