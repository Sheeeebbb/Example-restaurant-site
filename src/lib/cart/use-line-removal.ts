"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCartStore } from "./store";

/**
 * How long a line takes to leave the cart.
 *
 * Long enough to read as a departure rather than a glitch, short enough that
 * removing three things in a row never feels like queuing. The CSS transition
 * on the row and this timer are the same number so the line is removed on the
 * frame it finishes fading, not before it and not visibly after.
 */
export const REMOVE_ANIMATION_MS = 340;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Removing a line, with the fade that goes with it.
 *
 * Owned by whichever component renders the LIST — the cart page and the header
 * preview each hold one — because the set of lines on their way out is a
 * property of the list, not of a row. A row that owned its own exit would lose
 * it the moment it unmounted, which is precisely when it matters.
 *
 * The line stays in the store until the fade finishes. That is deliberate: the
 * subtotal, the item count and the row on screen then always agree with each
 * other, and the empty state cannot appear underneath a line that is still
 * visible. Nothing is blocked meanwhile — every other control keeps working,
 * and a second press on the same row is ignored rather than starting a second
 * animation.
 *
 * Two ways out are covered so a line can never be stranded mid-fade:
 *
 *   • unmounting (the preview closes, the customer navigates away) removes
 *     whatever was still leaving, immediately;
 *   • `prefers-reduced-motion` skips the animation and the wait entirely, so
 *     the removal is instant rather than a motionless 340ms pause.
 */
export function useLineRemoval() {
  const removeLine = useCartStore((state) => state.removeLine);
  const setQuantity = useCartStore((state) => state.setQuantity);

  const [leaving, setLeaving] = useState<readonly string[]>([]);
  const timers = useRef(new Map<string, number>());

  /*
   * Finish what is in flight, however the page ends.
   *
   * Unmounting covers the ordinary cases — the preview closes, a client-side
   * navigation swaps the page out. `pagehide` covers the one it cannot: a full
   * page load tears the JavaScript context down without ever running a React
   * cleanup, so a customer who pressed Remove and immediately followed a link
   * to another site would have found the line still sitting in their cart when
   * they came back. The store writes through to localStorage synchronously, so
   * flushing here lands before the page goes away.
   *
   * Zustand defines its actions once, so `removeLine` keeps the same identity
   * for the life of the store and this effect runs on mount and unmount only —
   * which is what it needs, since re-running it mid-fade would remove lines
   * that are still on screen.
   */
  useEffect(() => {
    const pending = timers.current;
    const flush = () => {
      for (const [lineId, timer] of pending) {
        window.clearTimeout(timer);
        removeLine(lineId);
      }
      pending.clear();
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [removeLine]);

  const requestRemove = useCallback(
    (lineId: string) => {
      // Already on its way out. A second press must not start a second timer.
      if (timers.current.has(lineId)) return;

      if (prefersReducedMotion()) {
        removeLine(lineId);
        return;
      }

      setLeaving((current) =>
        current.includes(lineId) ? current : [...current, lineId],
      );

      const timer = window.setTimeout(() => {
        timers.current.delete(lineId);
        setLeaving((current) => current.filter((id) => id !== lineId));
        removeLine(lineId);
      }, REMOVE_ANIMATION_MS);

      timers.current.set(lineId, timer);
    },
    [removeLine],
  );

  /**
   * The stepper's only route into the cart.
   *
   * Dropping to zero is how "minus at one" is expressed, and it means the same
   * thing as pressing Remove — so it takes the same path and gets the same
   * fade, rather than the line blinking out of existence.
   */
  const changeQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        requestRemove(lineId);
        return;
      }
      // A line that is leaving does not come back because someone caught the
      // plus button on its way out.
      if (timers.current.has(lineId)) return;
      setQuantity(lineId, quantity);
    },
    [requestRemove, setQuantity],
  );

  const isLeaving = useCallback(
    (lineId: string) => leaving.includes(lineId),
    [leaving],
  );

  return { isLeaving, requestRemove, changeQuantity };
}
