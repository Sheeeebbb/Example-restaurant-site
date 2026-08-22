"use client";

import { useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/lib/cart/store";
import { canQuickAdd, defaultSelectionsFor } from "@/lib/cart/lines";
import { Button } from "@/components/ui/Button";
import type { MenuItem } from "@/lib/types";

/**
 * Adds an item to the cart for real — this is not a decorative button.
 *
 * It has three genuine states, and never pretends to be in one it isn't:
 *
 *   • Quick-addable  → adds a fully specified line using the item's default
 *                      options, and the header count updates immediately.
 *   • Needs choices  → an item with a required group and no sensible default
 *                      can't be added in one tap, so this links through to the
 *                      customiser rather than adding something half-specified.
 *   • Unavailable    → disabled, because staff marked it sold out.
 */
export function AddToCartButton({
  item,
  className = "",
}: {
  item: MenuItem;
  className?: string;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);

  if (!item.available) {
    return (
      <Button variant="secondary" size="sm" disabled className={className}>
        Sold out
      </Button>
    );
  }

  if (!canQuickAdd(item)) {
    return (
      <Link
        href={`/menu/${item.slug}`}
        className={`inline-flex min-h-9 items-center justify-center rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken ${className}`}
      >
        Choose options
      </Link>
    );
  }

  const handleAdd = () => {
    addItem(item, defaultSelectionsFor(item), 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <>
      <Button size="sm" onClick={handleAdd} className={className}>
        {justAdded ? "Added" : "Add to cart"}
      </Button>
      {/*
        Announces the add to assistive tech. Scoped to this button rather than
        living in the header, so the confirmation is tied to the action that
        caused it.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {justAdded ? `${item.name} added to cart` : ""}
      </span>
    </>
  );
}
