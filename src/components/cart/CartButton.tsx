"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCartCount } from "@/lib/cart/selectors";
import { useCartStore } from "@/lib/cart/store";

/**
 * Cart entry point with an item count.
 *
 * Below `sm` the word "Cart" is dropped and only the trolley glyph and the
 * count remain, so the logo, cart, and "Order Now" all fit on one row at 360px
 * instead of pushing the sticky header to three rows.
 *
 * Nothing is lost to assistive tech: the icon and badge are `aria-hidden`, and
 * the link's accessible name always spells out "Cart, 2 items" in full. A live
 * region is deliberately NOT nested inside the link — it would make the count
 * announce twice. Adds are announced next to the button that causes them.
 *
 * The badge gives a small kick whenever the count goes up, so an add that
 * happens elsewhere on the page — in the product panel, which then closes —
 * still resolves somewhere the customer can see. It fires on increases only:
 * removing a line is not something to celebrate, and the first render after
 * hydration restores a saved cart rather than adding to one.
 */
const BUMP_MS = 420;

export function CartButton() {
  const count = useCartCount();
  const hydrated = useCartStore((state) => state.hasHydrated);
  const [bump, setBump] = useState(false);
  const previous = useRef(count);
  const settled = useRef(false);

  useEffect(() => {
    if (!hydrated) return;

    // The count goes 0 → n the moment a saved cart is read back from storage.
    // That is a restore, not an add, so the first hydrated count is adopted
    // silently and only what happens after it counts.
    if (!settled.current) {
      settled.current = true;
      previous.current = count;
      return;
    }

    const grew = count > previous.current;
    previous.current = count;
    if (!grew) return;

    setBump(true);
    const timer = window.setTimeout(() => setBump(false), BUMP_MS);
    return () => window.clearTimeout(timer);
  }, [count, hydrated]);

  return (
    <Link
      href="/cart"
      className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken sm:px-4"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-[1.15rem] w-[1.15rem] sm:hidden"
      >
        <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 2-1.55L20 7H6" />
        <circle cx="10" cy="20" r="1.2" />
        <circle cx="17" cy="20" r="1.2" />
      </svg>

      <span aria-hidden="true" className="hidden sm:inline">
        Cart
      </span>

      <span className="sr-only">
        Cart, {count} {count === 1 ? "item" : "items"}
      </span>

      <span
        aria-hidden="true"
        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ember px-1.5 text-xs font-semibold text-on-ember ${
          bump ? "motion-safe:animate-[cart-bump_420ms_ease-out]" : ""
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
