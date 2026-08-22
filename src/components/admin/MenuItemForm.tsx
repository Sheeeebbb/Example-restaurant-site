"use client";

import { useState } from "react";
import { parseMoney, formatMoney } from "@/lib/money";
import type { Category, DietaryTag, MenuItem } from "@/lib/types";

const TAGS: DietaryTag[] = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "spicy",
  "contains-nuts",
];

/**
 * Add or edit a dish.
 *
 * Prices are typed in euros and converted to integer cents on the way out, so
 * the domain rule (money is always cents) holds even though nobody wants to
 * type 1395 for a burger.
 *
 * Editing keeps the dish's option groups untouched — the form has no way to
 * express them, so it must not silently discard them. That is enforced in
 * `updateMenuItem`, not just here.
 */
export function MenuItemForm({
  item,
  categories,
  onCancel,
  onSaved,
}: {
  item: MenuItem | null;
  categories: Category[];
  onCancel: () => void;
  onSaved: (item: MenuItem, wasNew: boolean) => void;
}) {
  const isNew = item === null;

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(
    item ? (item.basePrice / 100).toFixed(2) : "",
  );
  const [kitchenMinutes, setKitchenMinutes] = useState(
    String(item?.kitchenMinutes ?? 10),
  );
  const [available, setAvailable] = useState(item?.available ?? true);
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [tags, setTags] = useState<DietaryTag[]>(item?.tags ?? []);
  const [allergens, setAllergens] = useState((item?.allergens ?? []).join(", "));

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const basePrice = parseMoney(price);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (basePrice === null) {
      setError("Enter a price, like 13.95.");
      return;
    }

    setSaving(true);
    const payload = {
      name,
      description,
      categoryId,
      basePrice,
      available,
      featured,
      tags,
      allergens: allergens
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
      kitchenMinutes: Number(kitchenMinutes) || 0,
    };

    const response = await fetch(
      isNew ? "/api/admin/menu" : `/api/admin/menu/${item.id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as
      | { ok: true; item: MenuItem }
      | { ok: false; error: string };

    setSaving(false);
    if (!body.ok) {
      setError(body.error);
      return;
    }
    onSaved(body.item, isNew);
  };

  const field = "mt-2 min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle";

  return (
    <form onSubmit={submit} noValidate className="rounded-card border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-semibold text-ink">
        {isNew ? "Add a dish" : `Edit ${item.name}`}
      </h1>
      {!isNew && (
        <p className="mt-1 text-sm text-ink-muted">
          The web address stays <code>/menu/{item.slug}</code> so existing links
          keep working.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="text-sm font-medium text-ink">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="text-sm font-medium text-ink">Description</label>
          <textarea
            id="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-control border border-line bg-surface p-3 text-sm text-ink"
          />
        </div>

        <div>
          <label htmlFor="categoryId" className="text-sm font-medium text-ink">Category</label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={field}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="price" className="text-sm font-medium text-ink">Price (€)</label>
          <input
            id="price"
            inputMode="decimal"
            placeholder="13.95"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={field}
          />
          {basePrice !== null && (
            <p className="mt-1 text-xs text-ink-subtle">
              Stored as {basePrice} cents · shows as {formatMoney(basePrice)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="kitchenMinutes" className="text-sm font-medium text-ink">
            Prep time (minutes)
          </label>
          <input
            id="kitchenMinutes"
            inputMode="numeric"
            value={kitchenMinutes}
            onChange={(e) => setKitchenMinutes(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label htmlFor="allergens" className="text-sm font-medium text-ink">
            Allergens <span className="font-normal text-ink-subtle">(comma separated)</span>
          </label>
          <input
            id="allergens"
            value={allergens}
            onChange={(e) => setAllergens(e.target.value)}
            placeholder="gluten, milk, egg"
            className={field}
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-ink">Dietary tags</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <label
                  key={tag}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                    on ? "border-ember bg-ember-soft text-ember" : "border-line-strong bg-surface text-ink-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setTags((current) =>
                        on ? current.filter((t) => t !== tag) : [...current, tag],
                      )
                    }
                    className="sr-only"
                  />
                  {tag.replace("-", " ")}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-5 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="h-4 w-4 accent-[var(--ember)]"
            />
            Available to order
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="h-4 w-4 accent-[var(--ember)]"
            />
            Feature on the homepage
          </label>
        </div>
      </div>

      {isNew && (
        <p className="mt-5 rounded-control bg-surface-sunken p-3 text-sm leading-relaxed text-ink-muted">
          New dishes start without customisation options. Sizes, extras and
          sauces are composed in <code>lib/data/option-groups.ts</code> — a form
          that could express every rule in that system would be a project of its
          own, so this prototype leaves them to code.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center rounded-control bg-ember px-5 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : isNew ? "Add dish" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
