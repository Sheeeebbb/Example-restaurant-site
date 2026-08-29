import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "./client";
import * as t from "./schema";
import type { DietaryTag, MenuItem, OptionGroup } from "../types";
import { DEFAULT_LOCALE, type Locale } from "../../i18n/config";

/**
 * Assembling a `MenuItem` from its four tables.
 *
 * Shared by the customer read path (`data/repository.ts`) and the staff write
 * path (`admin/menu-admin.ts`) so there is one definition of what a menu item
 * is when it comes back out of the database.
 *
 * Three queries, not one per item: the groups and options are fetched for the
 * whole result set at once and stitched in memory. A join would return the item
 * repeated once per option — 225 option rows across 25 dishes — and the
 * stitching would still have to happen, just over more data.
 */

type ItemRow = typeof t.menuItems.$inferSelect;
type GroupRow = typeof t.optionGroups.$inferSelect;
type OptionRow = typeof t.menuOptions.$inferSelect;

/**
 * The group id as the domain knows it.
 *
 * Rows are keyed `"<itemId>::<groupId>"` because the same shared group — "Add
 * protein" — is composed onto several dishes and each needs its own row. The
 * domain has always used the bare id, and the cart's content-addressed line ids
 * are derived from it, so it is restored on the way out.
 */
function bareId(rowId: string): string {
  const separator = rowId.lastIndexOf("::");
  return separator === -1 ? rowId : rowId.slice(separator + 2);
}

/**
 * A dish, in one language.
 *
 * The translation supplies words and nothing else. Everything that decides what
 * a customer is buying — the id, the slug, the price, availability, allergens,
 * the option groups — comes from the item row regardless of language, so
 * switching language cannot change the order.
 *
 * A null or absent field falls through to the English column. That is the whole
 * fallback: a half-translated dish shows its Dutch name and its English
 * description rather than a blank line.
 */
function toMenuItem(
  item: ItemRow,
  groups: GroupRow[],
  optionsByGroup: Map<string, OptionRow[]>,
  translation?: { name: string | null; description: string | null },
): MenuItem {
  const optionGroups: OptionGroup[] = groups.map((group) => ({
    id: bareId(group.id),
    name: group.name,
    ...(group.description ? { description: group.description } : {}),
    selection: group.selection as OptionGroup["selection"],
    required: group.required,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    options: (optionsByGroup.get(group.id) ?? []).map((option) => ({
      id: bareId(option.id),
      name: option.name,
      priceDelta: option.priceDelta,
      available: option.available,
      ...(option.isDefault ? { isDefault: true } : {}),
    })),
  }));

  return {
    id: item.id,
    slug: item.slug,
    categoryId: item.categoryId,
    name: translation?.name || item.name,
    description: translation?.description || item.description,
    basePrice: item.basePrice,
    image: { src: item.imageSrc, alt: item.imageAlt },
    tags: item.tags as DietaryTag[],
    allergens: item.allergens,
    available: item.available,
    featured: item.featured,
    kitchenMinutes: item.kitchenMinutes,
    optionGroups,
  };
}

/** Fetches the customisation for a set of items and hangs it on them. */
export async function hydrateItems(
  db: Db | Tx,
  items: ItemRow[],
  locale: Locale = DEFAULT_LOCALE,
): Promise<MenuItem[]> {
  if (items.length === 0) return [];

  const itemIds = items.map((item) => item.id);

  /*
   * One query for the whole page's translations, not one per dish. Skipped
   * entirely for English, which is what the columns already hold.
   */
  const translations = new Map<string, { name: string | null; description: string | null }>();
  if (locale !== DEFAULT_LOCALE) {
    const rows = await db
      .select()
      .from(t.menuItemTranslations)
      .where(
        and(
          inArray(t.menuItemTranslations.menuItemId, itemIds),
          eq(t.menuItemTranslations.locale, locale),
        ),
      );
    for (const row of rows) {
      translations.set(row.menuItemId, { name: row.name, description: row.description });
    }
  }
  const groups = await db
    .select()
    .from(t.optionGroups)
    .where(inArray(t.optionGroups.menuItemId, itemIds))
    .orderBy(asc(t.optionGroups.sortOrder));

  const optionsByGroup = new Map<string, OptionRow[]>();
  if (groups.length > 0) {
    const options = await db
      .select()
      .from(t.menuOptions)
      .where(
        inArray(
          t.menuOptions.optionGroupId,
          groups.map((group) => group.id),
        ),
      )
      .orderBy(asc(t.menuOptions.sortOrder));
    for (const option of options) {
      const bucket = optionsByGroup.get(option.optionGroupId);
      if (bucket) bucket.push(option);
      else optionsByGroup.set(option.optionGroupId, [option]);
    }
  }

  const groupsByItem = new Map<string, GroupRow[]>();
  for (const group of groups) {
    const bucket = groupsByItem.get(group.menuItemId);
    if (bucket) bucket.push(group);
    else groupsByItem.set(group.menuItemId, [group]);
  }

  return items.map((item) =>
    toMenuItem(item, groupsByItem.get(item.id) ?? [], optionsByGroup, translations.get(item.id)),
  );
}

/** Every menu item, in a stable order. */
export async function loadMenu(db: Db | Tx, locale: Locale = DEFAULT_LOCALE): Promise<MenuItem[]> {
  const items = await db.select().from(t.menuItems).orderBy(asc(t.menuItems.sortOrder), asc(t.menuItems.id));
  return hydrateItems(db, items, locale);
}

export async function loadMenuItemById(
  db: Db | Tx,
  id: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MenuItem | null> {
  const items = await db.select().from(t.menuItems).where(eq(t.menuItems.id, id));
  return (await hydrateItems(db, items, locale))[0] ?? null;
}

export async function loadMenuItemBySlug(
  db: Db | Tx,
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MenuItem | null> {
  const items = await db.select().from(t.menuItems).where(eq(t.menuItems.slug, slug));
  return (await hydrateItems(db, items, locale))[0] ?? null;
}
