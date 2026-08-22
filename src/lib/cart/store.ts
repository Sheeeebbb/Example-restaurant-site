"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CartLine,
  FulfillmentType,
  MenuItem,
  SelectedOption,
  TimingMode,
} from "../types";
import { RESTAURANT } from "../config/restaurant";
import { createCartLine } from "./lines";

/**
 * Cart state.
 *
 * Why a store rather than React Context: the cart is read by the header badge,
 * the menu cards, the cart drawer, and every checkout step — a cross-cutting
 * concern with no natural common ancestor below the root layout. Zustand keeps
 * that out of a provider tree and lets components subscribe to just the slice
 * they use, so bumping a quantity does not re-render the whole page.
 *
 * WHAT IS PERSISTED, AND WHAT IS NOT
 * The basket, fulfilment choice, and the promo *code* survive a refresh. The
 * promo's *discount* is not stored: only the code is kept, and it is
 * re-validated against the live subtotal on every render. Persisting a computed
 * discount would let a stale — or hand-edited — localStorage value quietly
 * follow the customer to checkout.
 *
 * Customer name, phone, email, and address are deliberately NOT in this store.
 * They live in component state during checkout and go straight to the order.
 * Personal data does not belong in localStorage.
 */

interface CartState {
  lines: CartLine[];
  fulfillmentType: FulfillmentType;
  timing: TimingMode;
  /** ISO slot, set only when `timing` is "scheduled". */
  scheduledFor?: string;
  /** Kept so the cart can price delivery before the customer reaches checkout. */
  postalCode: string;
  /** The code only — never the resolved discount. See note above. */
  promotionCode?: string;
  /** False until localStorage has been read; UI renders a neutral state first. */
  hasHydrated: boolean;

  addItem: (
    item: MenuItem,
    selections: SelectedOption[],
    quantity?: number,
    notes?: string,
  ) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;

  setFulfillmentType: (type: FulfillmentType) => void;
  setTiming: (timing: TimingMode) => void;
  setScheduledFor: (iso: string | undefined) => void;
  setPostalCode: (postalCode: string) => void;

  setPromotionCode: (code: string | undefined) => void;
  setHasHydrated: (value: boolean) => void;
}

const { maxQuantityPerLine } = RESTAURANT.ordering;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      fulfillmentType: "delivery",
      timing: "asap",
      scheduledFor: undefined,
      postalCode: "",
      promotionCode: undefined,
      hasHydrated: false,

      addItem: (item, selections, quantity = 1, notes) =>
        set((state) => {
          const line = createCartLine(item, selections, quantity, notes);
          const existing = state.lines.find(
            (candidate) => candidate.lineId === line.lineId,
          );

          // Same configuration => same lineId => merge rather than duplicate.
          if (existing) {
            return {
              lines: state.lines.map((candidate) =>
                candidate.lineId === line.lineId
                  ? {
                      ...candidate,
                      quantity: Math.min(
                        candidate.quantity + quantity,
                        maxQuantityPerLine,
                      ),
                    }
                  : candidate,
              ),
            };
          }

          return { lines: [...state.lines, line] };
        }),

      setQuantity: (lineId, quantity) =>
        set((state) => {
          // Dropping to zero is how the stepper deletes a line.
          if (quantity <= 0) {
            return { lines: state.lines.filter((line) => line.lineId !== lineId) };
          }
          return {
            lines: state.lines.map((line) =>
              line.lineId === lineId
                ? { ...line, quantity: Math.min(quantity, maxQuantityPerLine) }
                : line,
            ),
          };
        }),

      incrementLine: (lineId) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.lineId === lineId
              ? { ...line, quantity: Math.min(line.quantity + 1, maxQuantityPerLine) }
              : line,
          ),
        })),

      decrementLine: (lineId) =>
        set((state) => ({
          lines: state.lines
            .map((line) =>
              line.lineId === lineId ? { ...line, quantity: line.quantity - 1 } : line,
            )
            .filter((line) => line.quantity > 0),
        })),

      removeLine: (lineId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.lineId !== lineId),
        })),

      clearCart: () => set({ lines: [], promotionCode: undefined }),

      setFulfillmentType: (fulfillmentType) =>
        // Switching mode invalidates a scheduled slot: lead times differ between
        // pickup and delivery, so the old slot may no longer be reachable.
        set({ fulfillmentType, scheduledFor: undefined, timing: "asap" }),

      setTiming: (timing) =>
        set(timing === "asap" ? { timing, scheduledFor: undefined } : { timing }),

      setScheduledFor: (scheduledFor) => set({ scheduledFor, timing: "scheduled" }),
      setPostalCode: (postalCode) => set({ postalCode }),
      setPromotionCode: (promotionCode) => set({ promotionCode }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "urban-table-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),

      /**
       * Rehydration is deferred to an effect (see `CartHydration`). Reading
       * localStorage during module evaluation would give the first client render
       * different data from the server-rendered HTML and trip a hydration
       * mismatch.
       */
      skipHydration: true,

      partialize: (state) => ({
        lines: state.lines,
        fulfillmentType: state.fulfillmentType,
        timing: state.timing,
        scheduledFor: state.scheduledFor,
        postalCode: state.postalCode,
        promotionCode: state.promotionCode,
      }),

      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
