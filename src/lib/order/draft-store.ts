"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { EMPTY_DRAFT, type DraftField, type OrderDraft } from "./validation";

/**
 * The customer's contact and delivery details, while they are being filled in.
 *
 * SEPARATE FROM THE CART, AND STORED DIFFERENTLY ON PURPOSE.
 *
 * The cart lives in localStorage: a basket is worth keeping for days, and a
 * list of burgers identifies nobody. This store holds a name, phone number,
 * email address and home address — so it uses sessionStorage instead, and is
 * gone when the tab closes. Persisting it at all is only to survive the hop
 * from cart to checkout and a stray refresh; it is not a convenience worth
 * leaving someone's address on a shared machine for.
 *
 * `clearDraft()` runs once an order is placed, so the details do not sit around
 * afterwards.
 */

interface DraftState {
  draft: OrderDraft;
  /** False until sessionStorage has been read; keeps SSR and first paint in step. */
  hasHydrated: boolean;

  setField: (field: DraftField, value: string) => void;
  clearDraft: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useOrderDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      draft: EMPTY_DRAFT,
      hasHydrated: false,

      setField: (field, value) =>
        set((state) => ({ draft: { ...state.draft, [field]: value } })),

      clearDraft: () => set({ draft: EMPTY_DRAFT }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "urban-table-order-draft",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      // Read in an effect rather than at module load, for the same reason as the
      // cart store: the first client render must match the server's HTML.
      skipHydration: true,
      partialize: (state) => ({ draft: state.draft }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
