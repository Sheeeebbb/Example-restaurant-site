import type { Category, MenuItem, Promotion } from "../types";
import { CATEGORIES } from "./menu";
import { getStore } from "../server/store";
import { findPromotion } from "./promotions";

/**
 * The data access seam.
 *
 * Every function here is `async` even though all of it currently resolves from
 * local modules. That is the whole point: when the menu moves to Postgres or a
 * REST API, only these function *bodies* change. Call sites already `await`,
 * already handle "not found", and never have to be revisited.
 *
 * Nothing outside this folder imports `./menu` directly — components go through
 * these functions, so there is exactly one place to swap.
 *
 * Items now come from the mutable server store rather than the seed module, so
 * a change staff make in the admin area is visible on the customer menu
 * immediately. `./menu` is the factory default the store is seeded from.
 */

/** Defensive copy, so a caller mutating a result cannot corrupt the seed data. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function getCategories(): Promise<Category[]> {
  return clone(CATEGORIES).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return clone(CATEGORIES.find((category) => category.slug === slug) ?? null);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return clone(CATEGORIES.find((category) => category.id === id) ?? null);
}

export interface MenuQuery {
  /** Category slug. Omit for the full menu. */
  category?: string;
  /** Hide items staff have marked unavailable. Defaults to false so the menu stays honest. */
  availableOnly?: boolean;
  featuredOnly?: boolean;
}

export async function getMenuItems(query: MenuQuery = {}): Promise<MenuItem[]> {
  let items = clone(getStore().menu);

  if (query.category) {
    const category = CATEGORIES.find((entry) => entry.slug === query.category);
    if (!category) return [];
    items = items.filter((item) => item.categoryId === category.id);
  }

  if (query.availableOnly) items = items.filter((item) => item.available);
  if (query.featuredOnly) items = items.filter((item) => item.featured);

  return items;
}

export async function getMenuItemBySlug(slug: string): Promise<MenuItem | null> {
  return clone(getStore().menu.find((item) => item.slug === slug) ?? null);
}

export async function getMenuItemsByIds(ids: string[]): Promise<MenuItem[]> {
  const wanted = new Set(ids);
  return clone(getStore().menu.filter((item) => wanted.has(item.id)));
}

/** Categories paired with their items — one call for the whole menu page. */
export async function getMenuByCategory(): Promise<
  { category: Category; items: MenuItem[] }[]
> {
  const categories = await getCategories();
  const items = await getMenuItems();

  return categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0);
}

export async function getPromotion(code: string): Promise<Promotion | null> {
  return clone(findPromotion(code));
}

/** All slugs, for `generateStaticParams` on the product routes in stage 2. */
export async function getAllMenuSlugs(): Promise<string[]> {
  return getStore().menu.map((item) => item.slug);
}
