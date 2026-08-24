"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MenuItemForm } from "./MenuItemForm";
import { formatMoney } from "@/lib/money";
import type { Category, MenuItem } from "@/lib/types";

/**
 * Menu management.
 *
 * Availability is a single toggle in the row, because taking a dish off for the
 * evening is the thing staff do many times a shift; editing and deleting live
 * behind a step, because they are rarer and more consequential.
 *
 * Deleting asks for confirmation. It removes the dish from the customer menu
 * immediately and there is no undo, which is exactly the sort of action that
 * should not happen on a mis-tap during service.
 *
 * Each row shows the dish's photograph, so a menu with gaps in it is visible
 * without opening twenty-six forms to find out.
 */
export function MenuManager({
  initialItems,
  categories,
  photoMap,
}: {
  initialItems: MenuItem[];
  categories: Category[];
  photoMap: Record<string, string | null>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * A dish added or re-photographed in this session is not in the map the
   * server rendered. Its photograph is one staff just uploaded, which is served
   * by the route handler, so it can be shown directly; anything else unknown is
   * treated as absent rather than guessed at.
   */
  const thumbnailFor = (item: MenuItem): string | null =>
    item.image.src in photoMap
      ? photoMap[item.image.src]
      : item.image.src.startsWith("/api/menu-image/")
        ? item.image.src
        : null;

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "Uncategorised";

  const toggleAvailability = async (item: MenuItem) => {
    setBusy(item.id);
    setError(null);

    const response = await fetch(`/api/admin/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !item.available }),
    });

    setBusy(null);
    if (!response.ok) {
      setError("That change didn't save.");
      return;
    }

    const body = (await response.json()) as { item: MenuItem };
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? body.item : entry)),
    );
    router.refresh();
  };

  const remove = async (item: MenuItem) => {
    setBusy(item.id);
    setError(null);

    const response = await fetch(`/api/admin/menu/${item.id}`, { method: "DELETE" });

    setBusy(null);
    setConfirmingDelete(null);
    if (!response.ok) {
      setError("That dish couldn't be removed.");
      return;
    }

    setItems((current) => current.filter((entry) => entry.id !== item.id));
    router.refresh();
  };

  const handleSaved = (saved: MenuItem, wasNew: boolean) => {
    setItems((current) =>
      wasNew
        ? [...current, saved]
        : current.map((entry) => (entry.id === saved.id ? saved : entry)),
    );
    setEditing(null);
    setCreating(false);
    router.refresh();
  };

  if (creating || editing) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <MenuItemForm
          item={editing}
          categories={categories}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  const grouped = categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0);

  const unavailable = items.filter((item) => !item.available).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Menu
          </h1>
          <p className="mt-1 text-ink-muted">
            {items.length} dishes
            {unavailable > 0 && ` · ${unavailable} marked unavailable`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-11 items-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
        >
          Add a dish
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {grouped.map(({ category, items: categoryItems }) => (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <h2
              id={`cat-${category.id}`}
              className="font-display text-lg font-semibold text-ink"
            >
              {category.name}
            </h2>

            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {categoryItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-3 p-4 ${
                    item.available ? "" : "bg-surface-sunken"
                  }`}
                >
                  {/*
                    A thumbnail, so staff can see at a glance which dishes still
                    have no photograph. A plain <img> rather than next/image:
                    an uploaded photograph is served by a route handler and a
                    missing one must be allowed to simply fail to a blank tile.
                  */}
                  <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-control border border-line bg-surface-sunken">
                    {thumbnailFor(item) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumbnailFor(item) as string}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-center text-[0.625rem] leading-tight text-ink-subtle">
                        No photo
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {item.name}
                      {!item.available && (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                          Unavailable
                        </span>
                      )}
                      {item.featured && (
                        <span className="rounded-full bg-ember-soft px-2 py-0.5 text-xs font-semibold text-ember">
                          Featured
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">
                      {item.description}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {categoryName(item.categoryId)} · {item.optionGroups.length}{" "}
                      option {item.optionGroups.length === 1 ? "group" : "groups"} ·{" "}
                      {item.kitchenMinutes} min
                    </p>
                  </div>

                  <p className="w-20 shrink-0 text-right font-semibold tabular-nums text-ink">
                    {formatMoney(item.basePrice)}
                  </p>

                  {confirmingDelete === item.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm text-ink-muted">Remove it?</span>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={busy === item.id}
                        className="min-h-11 rounded-control bg-danger px-3 text-sm font-semibold text-on-danger disabled:opacity-50"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(null)}
                        className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(item)}
                        disabled={busy === item.id}
                        aria-pressed={!item.available}
                        className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50"
                      >
                        {item.available ? "Mark unavailable" : "Mark available"}
                        <span className="sr-only"> — {item.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
                      >
                        Edit
                        <span className="sr-only"> {item.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(item.id)}
                        className="min-h-11 rounded-control px-2 text-sm font-medium text-ink-muted transition-colors hover:text-danger"
                      >
                        Remove
                        <span className="sr-only"> {item.name}</span>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-subtle">
        Changes take effect on the customer menu immediately. Menu edits live in
        server memory for this prototype and reset when the server restarts.
      </p>
    </div>
  );
}
