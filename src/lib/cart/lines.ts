import type { CartLine, MenuItem, SelectedOption } from "../types";
import { sumCents } from "../money";

/**
 * Cart lines are content-addressed.
 *
 * The id is derived from the item plus its sorted selections and notes, so
 * "large, extra cheese" added twice increments one line instead of producing two
 * identical rows — while "large, no cheese" still gets a row of its own. Sorting
 * the selections first makes the id independent of the order the customer
 * happened to tick the boxes in.
 */
export function buildLineId(
  menuItemId: string,
  selections: SelectedOption[],
  notes?: string,
): string {
  const selectionKey = selections
    .map((selection) => `${selection.groupId}:${selection.optionId}`)
    .sort()
    .join(",");

  const trimmedNotes = notes?.trim();
  const notesKey = trimmedNotes ? `~${hashString(trimmedNotes)}` : "";

  return `${menuItemId}|${selectionKey}${notesKey}`;
}

/** Small non-cryptographic hash (FNV-1a). Only needs to separate lines, not resist attack. */
function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** basePrice plus every selected delta. Quantity is applied later, in the totals engine. */
export function calculateUnitPrice(
  basePrice: number,
  selections: SelectedOption[],
): number {
  return basePrice + sumCents(selections.map((selection) => selection.priceDelta));
}

/**
 * Builds a cart line from a menu item and the customer's choices, snapshotting
 * the display fields so the cart stays coherent if the menu changes underneath it.
 */
export function createCartLine(
  item: MenuItem,
  selections: SelectedOption[],
  quantity: number,
  notes?: string,
): CartLine {
  const trimmedNotes = notes?.trim() || undefined;

  return {
    lineId: buildLineId(item.id, selections, trimmedNotes),
    menuItemId: item.id,
    slug: item.slug,
    name: item.name,
    imageSrc: item.image.src,
    basePrice: item.basePrice,
    selections,
    unitPrice: calculateUnitPrice(item.basePrice, selections),
    quantity,
    notes: trimmedNotes,
  };
}

/**
 * Checks a set of selections against an item's option groups.
 * Returns the ids of groups that are not yet satisfied, so the customiser can
 * point at the specific group that is blocking rather than just disabling
 * the button with no explanation.
 */
export function findUnsatisfiedGroups(
  item: MenuItem,
  selections: SelectedOption[],
): string[] {
  return item.optionGroups
    .filter((group) => {
      const count = selections.filter((s) => s.groupId === group.id).length;
      if (group.required && count < Math.max(1, group.minSelections)) return true;
      return count > group.maxSelections;
    })
    .map((group) => group.id);
}
