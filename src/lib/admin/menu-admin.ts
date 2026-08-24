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
 * Deliberately simple: no option-group editor. Option groups are composed in
 * `data/option-groups.ts` and a new item starts with none, so staff can create
 * and price a dish without needing a form that can express every customisation
 * rule in the system.
 *
 * A dish has ONE photograph — `item.image` — and it is the same field the menu
 * card, the product panel, the cart line and the kitchen ticket all read. There
 * is no second "admin image": changing it here changes it everywhere, which is
 * the only behaviour that can stay correct.
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
  /**
   * Where the dish's photograph lives, from `/api/admin/menu/image`.
   *
   * Optional on an edit, and that is load-bearing: leaving it out means "keep
   * the photograph you already have", which is what cancelling an image change
   * has to do. Only a value that is actually here replaces anything.
   */
  imageSrc?: string;
  imageAlt?: string;
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

/**
 * A photograph must be a same-origin path this application serves.
 *
 * Uploads come back as `/api/menu-image/…` and the shipped photographs are
 * `/menu/….jpg`; anything else — a remote URL, a `javascript:` string, a walk
 * up the tree — is refused rather than written into the menu and rendered.
 */
function validImageSrc(src: string): boolean {
  return (
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !src.includes("..") &&
    src.length <= 300
  );
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
  if (input.imageSrc !== undefined && !validImageSrc(input.imageSrc)) {
    return { error: "That image address can't be used.", field: "imageSrc" };
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
    image: {
      // No photograph yet is a perfectly good state: the slug-shaped path is
      // where a shipped photograph would live, it resolves to nothing, and the
      // card renders its designed fallback tile until one exists.
      src: input.imageSrc ?? `/menu/${slug}.jpg`,
      alt: input.imageAlt?.trim() || input.name.trim(),
    },
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
    /*
     * The photograph is only touched when the edit carried a new one. An edit
     * that changes the price must not quietly drop the picture, and cancelling
     * an image change sends no `imageSrc` at all — so "absent" has to mean
     * "leave it alone", not "clear it".
     */
    image: input.imageSrc
      ? { src: input.imageSrc, alt: input.imageAlt?.trim() || input.name.trim() }
      : { ...existing.image, alt: input.imageAlt?.trim() || existing.image.alt },
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
