import type { MenuItem, OptionGroup, SelectedOption } from "../types";
import { calculateUnitPrice, findUnsatisfiedGroups } from "./lines";

/**
 * Product customisation state, as pure functions.
 *
 * The customiser UI is a thin shell over this module: React holds a
 * `SelectionState` and calls `toggleOption`, and every rule about what may be
 * selected, what a configuration costs, and whether it can be ordered lives
 * here. That keeps the rules testable without rendering anything, and means the
 * same logic can validate a configuration server-side at checkout.
 *
 * Nothing here knows what a burger is. Behaviour comes from each group's
 * `selection`, `required`, and `maxSelections` fields, so a new kind of choice
 * is new data, never a new branch.
 */

/** Chosen option ids, keyed by group id. */
export type SelectionState = Record<string, string[]>;

/** Pre-ticks each group's available default — the state the customiser opens in. */
export function initialSelections(item: MenuItem): SelectionState {
  const state: SelectionState = {};
  for (const group of item.optionGroups) {
    const defaults = group.options
      .filter((option) => option.isDefault && option.available)
      .slice(0, group.maxSelections)
      .map((option) => option.id);
    state[group.id] = defaults;
  }
  return state;
}

/**
 * Applies a tap on one option.
 *
 *   • single + required  — always replaces; re-tapping the current choice is a
 *                          no-op, because the group can never be left empty.
 *   • single + optional  — re-tapping clears it, so "Add protein" can be undone.
 *   • multi              — toggles, and refuses to exceed `maxSelections`.
 *
 * Unavailable options are ignored rather than silently added.
 */
export function toggleOption(
  item: MenuItem,
  state: SelectionState,
  groupId: string,
  optionId: string,
): SelectionState {
  const group = item.optionGroups.find((candidate) => candidate.id === groupId);
  if (!group) return state;

  const option = group.options.find((candidate) => candidate.id === optionId);
  if (!option || !option.available) return state;

  const current = state[groupId] ?? [];
  const isSelected = current.includes(optionId);

  let next: string[];
  if (group.selection === "single") {
    if (isSelected) {
      next = group.required ? current : [];
    } else {
      next = [optionId];
    }
  } else if (isSelected) {
    next = current.filter((id) => id !== optionId);
  } else if (current.length >= group.maxSelections) {
    return state; // At the cap; the UI disables these rather than relying on this.
  } else {
    next = [...current, optionId];
  }

  return { ...state, [groupId]: next };
}

/**
 * Flattens state into the cart's `SelectedOption[]`, snapshotting each option's
 * name and price. Group order is preserved so the cart lists choices in the same
 * order the customer saw them.
 */
export function toSelectedOptions(
  item: MenuItem,
  state: SelectionState,
): SelectedOption[] {
  return item.optionGroups.flatMap((group) => {
    const chosen = state[group.id] ?? [];
    return group.options
      .filter((option) => chosen.includes(option.id))
      .map((option) => ({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      }));
  });
}

/** Price of one unit with these options applied. Excludes quantity. */
export function unitPriceFor(item: MenuItem, state: SelectionState): number {
  return calculateUnitPrice(item.basePrice, toSelectedOptions(item, state));
}

/** What the customer will actually be charged: unit price × quantity. */
export function totalPriceFor(
  item: MenuItem,
  state: SelectionState,
  quantity: number,
): number {
  return unitPriceFor(item, state) * quantity;
}

/** Ids of groups blocking add-to-cart, so the UI can point at the specific one. */
export function unsatisfiedGroupIds(
  item: MenuItem,
  state: SelectionState,
): string[] {
  return findUnsatisfiedGroups(item, toSelectedOptions(item, state));
}

export function canAddToCart(item: MenuItem, state: SelectionState): boolean {
  if (!item.available) return false;
  return unsatisfiedGroupIds(item, state).length === 0;
}

/** True when the group has reached its cap, so remaining options should disable. */
export function isGroupAtCapacity(
  group: OptionGroup,
  state: SelectionState,
): boolean {
  if (group.selection === "single") return false;
  return (state[group.id]?.length ?? 0) >= group.maxSelections;
}

/**
 * Short human label for a group's rule — "Required", "Pick up to 2", "Optional".
 * Rendered next to the group heading so the constraint is visible before someone
 * runs into it.
 */
export function groupRuleLabel(group: OptionGroup): string {
  if (group.required) return "Required";
  if (group.selection === "multi" && group.maxSelections < group.options.length) {
    return `Pick up to ${group.maxSelections}`;
  }
  return "Optional";
}
