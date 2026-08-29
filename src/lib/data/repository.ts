import { and, asc, eq, inArray } from "drizzle-orm";
import type { Category, MenuItem, Promotion } from "../types";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { hydrateItems, loadMenuItemBySlug } from "../db/menu-queries";
import { DEFAULT_LOCALE, type Locale } from "../../i18n/config";
import { activeLocale } from "../../i18n/server";
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
 * Items come from Postgres, so a change staff make in the admin area is visible
 * on the customer menu immediately — and survives the process that served it.
 * `./menu` is the factory default the database is seeded from; nothing reads it
 * at request time any more.
 */

/**
 * The category headings, in the request's language.
 *
 * Translations live in their own table and supply words only — the id, slug and
 * sort order are the same in every language, so the menu's shape never depends
 * on who is reading it.
 */
export async function getCategories(locale?: Locale): Promise<Category[]> {
  const db = getDb();
  const active = locale ?? (await activeLocale());
  const rows = await db.select().from(t.categories).orderBy(asc(t.categories.sortOrder));
  if (active === DEFAULT_LOCALE) return rows;

  const translations = await db
    .select()
    .from(t.categoryTranslations)
    .where(eq(t.categoryTranslations.locale, active));
  const byId = new Map(translations.map((row) => [row.categoryId, row]));

  return rows.map((row) => {
    const translated = byId.get(row.id);
    return {
      ...row,
      name: translated?.name || row.name,
      description: translated?.description || row.description,
    };
  });
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return (await getCategories()).find((category) => category.id === id) ?? null;
}

export interface MenuQuery {
  /** Category slug. Omit for the full menu. */
  category?: string;
  /** Hide items staff have marked unavailable. Defaults to false so the menu stays honest. */
  availableOnly?: boolean;
  featuredOnly?: boolean;
}

export async function getMenuItems(query: MenuQuery = {}, locale?: Locale): Promise<MenuItem[]> {
  const db = getDb();
  const active = locale ?? (await activeLocale());

  /*
   * Filtered in SQL rather than in JavaScript. It matters more than it looks:
   * the category page used to load every dish and discard most of them, which
   * is free against a Map and is a full table scan plus its option rows against
   * a database.
   */
  const conditions = [];
  if (query.category) {
    const category = await db
      .select({ id: t.categories.id })
      .from(t.categories)
      .where(eq(t.categories.slug, query.category));
    if (category.length === 0) return [];
    conditions.push(eq(t.menuItems.categoryId, category[0].id));
  }
  if (query.availableOnly) conditions.push(eq(t.menuItems.available, true));
  if (query.featuredOnly) conditions.push(eq(t.menuItems.featured, true));

  const items = await db
    .select()
    .from(t.menuItems)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(t.menuItems.sortOrder), asc(t.menuItems.id));

  return hydrateItems(db, items, active);
}

export async function getMenuItemBySlug(slug: string, locale?: Locale): Promise<MenuItem | null> {
  return loadMenuItemBySlug(getDb(), slug, locale ?? (await activeLocale()));
}

export async function getMenuItemsByIds(ids: string[], locale?: Locale): Promise<MenuItem[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const active = locale ?? (await activeLocale());
  const items = await db
    .select()
    .from(t.menuItems)
    .where(inArray(t.menuItems.id, ids))
    .orderBy(asc(t.menuItems.sortOrder), asc(t.menuItems.id));
  return hydrateItems(db, items, active);
}

export async function getPromotion(code: string): Promise<Promotion | null> {
  /*
   * Still from the code module, deliberately. Promotions are a marketing
   * fixture with no runtime editor, and giving them a table nothing writes to
   * would be a migration to maintain for no capability gained. When a
   * promotions editor exists, this is the one line that changes.
   */
  return structuredClone(findPromotion(code));
}
