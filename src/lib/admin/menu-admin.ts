import type { MenuItem } from "../types";
import { getStore } from "../server/store";
import { CATEGORIES } from "../data/menu";

/**
 * Staff menu management. SERVER ONLY.
 *
 * Kept separate from `data/repository.ts` — that module is the customer's
 * read path and has no business exposing writes. A real deployment would put
 * an authorisation check in front of everything here.
 *
 * Deliberately simple: no image upload, no option-group editor. Option groups
 * are composed in `data/option-groups.ts` and a new item starts with none, so
 * staff can create and price a dish without needing a form that can express
 * every customisation rule in the system.
 */

export interface MenuItemInput {
  name: string;
  description: string;
  categoryId: string;
  /** Integer cents. */
  basePrice: number;
  available: boolean;
  featured: boolean;
  tags: MenuItem["tags"];
  allergens: string[];
  kitchenMinutes: number;
}

export type MenuAdminResult =
  | { ok: true; item: MenuItem }
  | { ok: false; error: string; field?: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Appends -2, -3… so two dishes with the same name still get distinct URLs. */
function uniqueSlug(base: string, excludeId?: string): string {
  const menu = getStore().menu;
  const taken = new Set(
    menu.filter((item) => item.id !== excludeId).map((item) => item.slug),
  );
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function validate(input: MenuItemInput): { error: string; field?: string } | null {
  if (!input.name?.trim()) return { error: "Give the dish a name.", field: "name" };
  if (input.name.trim().length > 80) {
    return { error: "That name is too long.", field: "name" };
  }
  if (!input.description?.trim()) {
    return { error: "Add a short description.", field: "description" };
  }
  if (!CATEGORIES.some((category) => category.id === input.categoryId)) {
    return { error: "Choose a category.", field: "categoryId" };
  }
  if (!Number.isInteger(input.basePrice) || input.basePrice < 0) {
    return { error: "Price must be a whole number of cents.", field: "basePrice" };
  }
  if (input.basePrice > 100_000) {
    return { error: "That price looks like a mistake.", field: "basePrice" };
  }
  if (!Number.isInteger(input.kitchenMinutes) || input.kitchenMinutes < 0) {
    return { error: "Prep time must be a whole number of minutes.", field: "kitchenMinutes" };
  }
  return null;
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuAdminResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, ...invalid };

  const slug = uniqueSlug(slugify(input.name));
  const item: MenuItem = {
    id: `itm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    slug,
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description.trim(),
    basePrice: input.basePrice,
    image: { src: `/menu/${slug}.jpg`, alt: input.name.trim() },
    tags: input.tags ?? [],
    allergens: input.allergens ?? [],
    available: input.available,
    featured: input.featured,
    kitchenMinutes: input.kitchenMinutes,
    // New dishes start uncustomisable. Option groups are composed in code, and
    // a form that could express every rule would be a project of its own.
    optionGroups: [],
  };

  getStore().menu.push(item);
  return { ok: true, item };
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
): Promise<MenuAdminResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, ...invalid };

  const menu = getStore().menu;
  const index = menu.findIndex((item) => item.id === id);
  if (index === -1) return { ok: false, error: "That dish no longer exists." };

  const existing = menu[index];
  // Renaming keeps the original slug: changing it would break every link and
  // bookmark already pointing at the dish.
  const updated: MenuItem = {
    ...existing,
    name: input.name.trim(),
    description: input.description.trim(),
    categoryId: input.categoryId,
    basePrice: input.basePrice,
    available: input.available,
    featured: input.featured,
    tags: input.tags ?? [],
    allergens: input.allergens ?? [],
    kitchenMinutes: input.kitchenMinutes,
  };

  menu[index] = updated;
  return { ok: true, item: updated };
}

/** Flips availability without touching anything else — the most common action. */
export async function setMenuItemAvailability(
  id: string,
  available: boolean,
): Promise<MenuAdminResult> {
  const menu = getStore().menu;
  const index = menu.findIndex((item) => item.id === id);
  if (index === -1) return { ok: false, error: "That dish no longer exists." };

  menu[index] = { ...menu[index], available };
  return { ok: true, item: menu[index] };
}

export async function deleteMenuItem(id: string): Promise<{ ok: boolean; error?: string }> {
  const menu = getStore().menu;
  const index = menu.findIndex((item) => item.id === id);
  if (index === -1) return { ok: false, error: "That dish no longer exists." };

  menu.splice(index, 1);
  return { ok: true };
}
