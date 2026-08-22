"use client";

import Link from "next/link";
import { useCartCount } from "@/lib/cart/selectors";

/**
 * Cart entry point with an item count.
 *
 * The numeric badge is decorative (`aria-hidden`); the link's accessible name
 * spells the same thing out in words, so assistive tech announces "Cart, 2
 * items" rather than "Cart 2". A live region is deliberately NOT nested inside
 * the link — it would make the count announce twice. Announcing an add lands in
 * stage 3, next to the action that causes it.
 */
export function CartButton() {
  const count = useCartCount();

  return (
    <Link
      href="/cart"
      className="relative inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
    >
      <span aria-hidden="true">Cart</span>
      <span className="sr-only">
        Cart, {count} {count === 1 ? "item" : "items"}
      </span>
      <span
        aria-hidden="true"
        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ember px-1.5 text-xs font-semibold text-on-ember"
      >
        {count}
      </span>
    </Link>
  );
}
