import { eq, ne } from "drizzle-orm";
import type { MenuItem } from "../types";
import { getDb, type Tx } from "../db/client";
import * as t from "../db/schema";
import { loadMenuItemById } from "../db/menu-queries";

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

/**
 * Appends -2, -3… so two dishes with the same name still get distinct URLs.
 *
 * Advisory only: `menu_items.slug` carries a UNIQUE constraint, so if two
 * managers create "Spring Salad" at the same instant one insert fails rather
 * than two dishes sharing a URL. This just makes the common case pleasant.
 */
async function uniqueSlug(tx: Tx, base: string, excludeId?: string): Promise<string> {
  const rows = await tx
    .select({ slug: t.menuItems.slug })
    .from(t.menuItems)
    .where(excludeId ? ne(t.menuItems.id, excludeId) : undefined);
  const taken = new Set(rows.map((row) => row.slug));
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
  // The category is checked against the database below, where the write is —
  // the foreign key is the real guard, this is only for a decent message.
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

  return getDb().transaction(async (tx) => {
    const category = await tx
      .select({ id: t.categories.id })
      .from(t.categories)
      .where(eq(t.categories.id, input.categoryId));
    if (category.length === 0) {
      return { ok: false, error: "Choose a category.", field: "categoryId" } as const;
    }

    const slug = await uniqueSlug(tx, slugify(input.name));
    const id = `itm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    await tx.insert(t.menuItems).values({
      id,
      slug,
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      basePrice: input.basePrice,
      // No photograph yet is a perfectly good state: the slug-shaped path is
      // where a shipped photograph would live, it resolves to nothing, and the
      // card renders its designed fallback tile until one exists.
      imageSrc: input.imageSrc ?? `/menu/${slug}.jpg`,
      imageAlt: input.imageAlt?.trim() || input.name.trim(),
      tags: input.tags ?? [],
      allergens: input.allergens ?? [],
      available: input.available,
      featured: input.featured,
      kitchenMinutes: input.kitchenMinutes,
    });

    // New dishes start uncustomisable. Option groups are composed in code, and
    // a form that could express every rule would be a project of its own.
    const item = await loadMenuItemById(tx, id);
    return item
      ? ({ ok: true, item } as const)
      : ({ ok: false, error: "The dish could not be created." } as const);
  });
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
): Promise<MenuAdminResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, ...invalid };

  return getDb().transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(t.menuItems)
      .where(eq(t.menuItems.id, id));
    if (existing.length === 0) {
      return { ok: false, error: "That dish no longer exists." } as const;
    }

    const category = await tx
      .select({ id: t.categories.id })
      .from(t.categories)
      .where(eq(t.categories.id, input.categoryId));
    if (category.length === 0) {
      return { ok: false, error: "Choose a category.", field: "categoryId" } as const;
    }

    // Renaming keeps the original slug: changing it would break every link and
    // bookmark already pointing at the dish.
    await tx
      .update(t.menuItems)
      .set({
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
         * The photograph is only touched when the edit carried a new one. An
         * edit that changes the price must not quietly drop the picture, and
         * cancelling an image change sends no `imageSrc` at all — so "absent"
         * has to mean "leave it alone", not "clear it".
         */
        ...(input.imageSrc
          ? {
              imageSrc: input.imageSrc,
              imageAlt: input.imageAlt?.trim() || input.name.trim(),
            }
          : { imageAlt: input.imageAlt?.trim() || existing[0].imageAlt }),
      })
      .where(eq(t.menuItems.id, id));

    const item = await loadMenuItemById(tx, id);
    return item
      ? ({ ok: true, item } as const)
      : ({ ok: false, error: "That dish no longer exists." } as const);
  });
}

/** Flips availability without touching anything else — the most common action. */
export async function setMenuItemAvailability(
  id: string,
  available: boolean,
): Promise<MenuAdminResult> {
  const db = getDb();
  const updated = await db
    .update(t.menuItems)
    .set({ available })
    .where(eq(t.menuItems.id, id))
    .returning({ id: t.menuItems.id });
  if (updated.length === 0) return { ok: false, error: "That dish no longer exists." };

  const item = await loadMenuItemById(db, id);
  return item ? { ok: true, item } : { ok: false, error: "That dish no longer exists." };
}

/**
 * Removes a dish from the menu.
 *
 * Its option groups and options go with it — `ON DELETE CASCADE`, because they
 * describe this dish and nothing else. What does NOT go with it is any order
 * that contained it: `order_items` holds its own copy of the name and price and
 * only a nullable reference back here, so deleting the Classic Burger today
 * leaves every receipt that sold one intact and readable.
 */
export async function deleteMenuItem(id: string): Promise<{ ok: boolean; error?: string }> {
  const deleted = await getDb()
    .delete(t.menuItems)
    .where(eq(t.menuItems.id, id))
    .returning({ id: t.menuItems.id });
  return deleted.length > 0
    ? { ok: true }
    : { ok: false, error: "That dish no longer exists." };
}
