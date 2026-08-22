import { describe, expect, it } from "vitest";
import {
  canAddToCart,
  groupRuleLabel,
  initialSelections,
  isGroupAtCapacity,
  toSelectedOptions,
  toggleOption,
  totalPriceFor,
  unitPriceFor,
  unsatisfiedGroupIds,
} from "./customization";
import { createCartLine } from "./lines";
import { MENU_ITEMS } from "../data/menu";
import type { MenuItem } from "../types";

const item = (slug: string): MenuItem => {
  const found = MENU_ITEMS.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`No such item: ${slug}`);
  return structuredClone(found);
};

const classic = () => item("urban-classic");

/** Applies a list of [groupId, optionId] taps in order. */
const tap = (menuItem: MenuItem, taps: [string, string][]) =>
  taps.reduce(
    (state, [groupId, optionId]) =>
      toggleOption(menuItem, state, groupId, optionId),
    initialSelections(menuItem),
  );

describe("the brief's worked example", () => {
  it("prices the Urban Classic Burger at 13,95 € before options", () => {
    expect(classic().basePrice).toBe(1395);
  });

  it("charges the advertised delta for each named extra", () => {
    const burger = classic();
    const extras = burger.optionGroups.find((g) => g.id === "grp-extras")!;
    const priceOf = (id: string) =>
      extras.options.find((o) => o.id === id)!.priceDelta;

    expect(priceOf("opt-ex-cheese")).toBe(150);
    expect(priceOf("opt-ex-bacon")).toBe(200);
    expect(priceOf("opt-ex-avocado")).toBe(200);
    expect(priceOf("opt-ex-patty")).toBe(400);
  });

  it("reaches 23,45 € with all four extras (13,95 + 1,50 + 2 + 2 + 4)", () => {
    const burger = classic();
    const state = tap(burger, [
      ["grp-extras", "opt-ex-cheese"],
      ["grp-extras", "opt-ex-bacon"],
      ["grp-extras", "opt-ex-avocado"],
      ["grp-extras", "opt-ex-patty"],
    ]);
    expect(unitPriceFor(burger, state)).toBe(2345);
  });

  it("multiplies that configuration by quantity", () => {
    const burger = classic();
    const state = tap(burger, [["grp-extras", "opt-ex-patty"]]);
    expect(unitPriceFor(burger, state)).toBe(1795);
    expect(totalPriceFor(burger, state, 3)).toBe(5385);
  });
});

describe("initialSelections", () => {
  it("pre-selects each group's available default", () => {
    const burger = classic();
    const state = initialSelections(burger);
    expect(state["grp-cook"]).toEqual(["opt-cook-medium"]);
    expect(state["grp-sauce"]).toEqual(["opt-sauce-house"]);
  });

  it("leaves groups without a default empty", () => {
    const state = initialSelections(classic());
    expect(state["grp-extras"]).toEqual([]);
    expect(state["grp-meal"]).toEqual([]);
  });

  it("opens at the item's base price", () => {
    const burger = classic();
    expect(unitPriceFor(burger, initialSelections(burger))).toBe(1395);
  });
});

describe("single-select groups", () => {
  it("replaces rather than accumulates", () => {
    const burger = classic();
    const state = tap(burger, [
      ["grp-cook", "opt-cook-well"],
      ["grp-cook", "opt-cook-medium-well"],
    ]);
    expect(state["grp-cook"]).toEqual(["opt-cook-medium-well"]);
  });

  it("cannot be emptied when required", () => {
    const burger = classic();
    const state = tap(burger, [["grp-cook", "opt-cook-medium"]]); // re-tap the default
    expect(state["grp-cook"]).toEqual(["opt-cook-medium"]);
  });

  it("can be cleared when optional, so an upsell is undoable", () => {
    const burger = classic();
    const added = tap(burger, [["grp-meal", "opt-meal-fries"]]);
    expect(unitPriceFor(burger, added)).toBe(1395 + 450);

    const removed = toggleOption(burger, added, "grp-meal", "opt-meal-fries");
    expect(removed["grp-meal"]).toEqual([]);
    expect(unitPriceFor(burger, removed)).toBe(1395);
  });
});

describe("multi-select groups", () => {
  it("accumulates and toggles off", () => {
    const burger = classic();
    const withTwo = tap(burger, [
      ["grp-extras", "opt-ex-cheese"],
      ["grp-extras", "opt-ex-bacon"],
    ]);
    expect(withTwo["grp-extras"]).toEqual(["opt-ex-cheese", "opt-ex-bacon"]);

    const withOne = toggleOption(burger, withTwo, "grp-extras", "opt-ex-cheese");
    expect(withOne["grp-extras"]).toEqual(["opt-ex-bacon"]);
    expect(unitPriceFor(burger, withOne)).toBe(1395 + 200);
  });

  it("refuses to exceed maxSelections", () => {
    const burger = classic();
    // Sauces caps at 2 and opens with one selected.
    const full = tap(burger, [
      ["grp-sauce", "opt-sauce-aioli"],
      ["grp-sauce", "opt-sauce-bbq"],
    ]);
    expect(full["grp-sauce"]).toHaveLength(2);
    expect(isGroupAtCapacity(burger.optionGroups.find((g) => g.id === "grp-sauce")!, full)).toBe(true);

    const stillFull = toggleOption(burger, full, "grp-sauce", "opt-sauce-sriracha");
    expect(stillFull["grp-sauce"]).toHaveLength(2);
    expect(stillFull["grp-sauce"]).not.toContain("opt-sauce-sriracha");
  });

  it("prices free options at zero", () => {
    const burger = classic();
    const state = tap(burger, [["grp-remove", "opt-no-pickles"]]);
    expect(state["grp-remove"]).toEqual(["opt-no-pickles"]);
    expect(unitPriceFor(burger, state)).toBe(1395);
  });
});

describe("validation", () => {
  it("allows adding once every required group is satisfied", () => {
    const burger = classic();
    expect(canAddToCart(burger, initialSelections(burger))).toBe(true);
  });

  it("blocks adding while a required group is empty, naming that group", () => {
    const burger = classic();
    const state = { ...initialSelections(burger), "grp-cook": [] };
    expect(unsatisfiedGroupIds(burger, state)).toEqual(["grp-cook"]);
    expect(canAddToCart(burger, state)).toBe(false);
  });

  it("blocks an item staff marked unavailable", () => {
    const soldOut = item("crispy-onion-rings");
    expect(soldOut.available).toBe(false);
    expect(canAddToCart(soldOut, initialSelections(soldOut))).toBe(false);
  });

  it("ignores taps on unavailable options", () => {
    const burger = classic();
    burger.optionGroups.find((g) => g.id === "grp-extras")!.options[0].available = false;
    const state = toggleOption(burger, initialSelections(burger), "grp-extras", "opt-ex-cheese");
    expect(state["grp-extras"]).toEqual([]);
  });

  it("ignores taps on groups the item does not offer", () => {
    const burger = classic();
    const before = initialSelections(burger);
    expect(toggleOption(burger, before, "grp-nonexistent", "opt-x")).toBe(before);
  });
});

describe("handing off to the cart", () => {
  it("snapshots names and prices in group order", () => {
    const burger = classic();
    const state = tap(burger, [
      ["grp-extras", "opt-ex-bacon"],
      ["grp-cook", "opt-cook-well"],
    ]);
    const selections = toSelectedOptions(burger, state);

    // Cook temperature is declared before extras, so it comes first.
    expect(selections.map((s) => s.name)).toEqual([
      "Well done",
      "Bacon",
      "House burger sauce",
    ]);
    expect(selections.find((s) => s.optionId === "opt-ex-bacon")).toMatchObject({
      groupName: "Extras",
      priceDelta: 200,
    });
  });

  it("builds a cart line whose unit price matches the customiser", () => {
    const burger = classic();
    const state = tap(burger, [
      ["grp-extras", "opt-ex-cheese"],
      ["grp-extras", "opt-ex-patty"],
    ]);
    const line = createCartLine(burger, toSelectedOptions(burger, state), 2, "  no napkins  ");

    expect(line.unitPrice).toBe(unitPriceFor(burger, state));
    expect(line.unitPrice).toBe(1395 + 150 + 400);
    expect(line.quantity).toBe(2);
    expect(line.notes).toBe("no napkins");
  });

  it("gives differently configured lines different ids, and identical ones the same id", () => {
    const burger = classic();
    const plain = initialSelections(burger);
    const withCheese = tap(burger, [["grp-extras", "opt-ex-cheese"]]);

    const a = createCartLine(burger, toSelectedOptions(burger, plain), 1);
    const b = createCartLine(burger, toSelectedOptions(burger, withCheese), 1);
    const c = createCartLine(burger, toSelectedOptions(burger, plain), 1);

    expect(a.lineId).not.toBe(b.lineId);
    expect(a.lineId).toBe(c.lineId);
  });

  it("separates lines that differ only by special instructions", () => {
    const burger = classic();
    const selections = toSelectedOptions(burger, initialSelections(burger));
    const plain = createCartLine(burger, selections, 1);
    const noted = createCartLine(burger, selections, 1, "extra crispy please");
    expect(plain.lineId).not.toBe(noted.lineId);
    expect(noted.notes).toBe("extra crispy please");
  });
});

describe("a required group with no default", () => {
  it("blocks the add until the customer answers, then allows it", () => {
    const water = item("spring-water");
    const empty = initialSelections(water);

    expect(empty["grp-water-style"]).toEqual([]);
    expect(canAddToCart(water, empty)).toBe(false);
    expect(unsatisfiedGroupIds(water, empty)).toEqual(["grp-water-style"]);

    const chosen = toggleOption(water, empty, "grp-water-style", "opt-water-sparkling");
    expect(canAddToCart(water, chosen)).toBe(true);
    expect(toSelectedOptions(water, chosen)[0].name).toBe("Sparkling");
  });
});

describe("group rule labels", () => {
  it("describes each constraint", () => {
    const burger = classic();
    const byId = (id: string) => burger.optionGroups.find((g) => g.id === id)!;
    expect(groupRuleLabel(byId("grp-cook"))).toBe("Required");
    expect(groupRuleLabel(byId("grp-sauce"))).toBe("Pick up to 2");
    expect(groupRuleLabel(byId("grp-meal"))).toBe("Optional");
  });
});

describe("the whole seed menu is coherent", () => {
  it("never gives a required group more than one available default", () => {
    for (const menuItem of MENU_ITEMS) {
      for (const group of menuItem.optionGroups) {
        if (!group.required) continue;
        const defaults = group.options.filter((o) => o.isDefault && o.available);
        expect(
          defaults.length,
          `${menuItem.name} → ${group.name} has competing defaults`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("can add an item from its defaults exactly when every required group has one", () => {
    for (const menuItem of MENU_ITEMS.filter((entry) => entry.available)) {
      const everyRequiredHasDefault = menuItem.optionGroups
        .filter((group) => group.required)
        .every((group) =>
          group.options.some((option) => option.isDefault && option.available),
        );
      expect(
        canAddToCart(menuItem, initialSelections(menuItem)),
        menuItem.name,
      ).toBe(everyRequiredHasDefault);
    }
  });

  it("keeps every featured item one-tap addable, as the homepage assumes", () => {
    for (const menuItem of MENU_ITEMS.filter((entry) => entry.featured)) {
      expect(
        canAddToCart(menuItem, initialSelections(menuItem)),
        `${menuItem.name} is featured but needs the customiser`,
      ).toBe(true);
    }
  });

  it("never declares a default the group's cap cannot hold", () => {
    for (const menuItem of MENU_ITEMS) {
      for (const group of menuItem.optionGroups) {
        const defaults = group.options.filter((o) => o.isDefault && o.available);
        expect(
          defaults.length,
          `${menuItem.name} → ${group.name}`,
        ).toBeLessThanOrEqual(group.maxSelections);
      }
    }
  });

  it("keeps option ids unique within each group", () => {
    for (const menuItem of MENU_ITEMS) {
      for (const group of menuItem.optionGroups) {
        const ids = group.options.map((o) => o.id);
        expect(new Set(ids).size, `${menuItem.name} → ${group.name}`).toBe(ids.length);
      }
    }
  });

  it("keeps group ids unique within each item", () => {
    for (const menuItem of MENU_ITEMS) {
      const ids = menuItem.optionGroups.map((g) => g.id);
      expect(new Set(ids).size, menuItem.name).toBe(ids.length);
    }
  });

  it("keeps slugs and ids unique across the menu", () => {
    expect(new Set(MENU_ITEMS.map((i) => i.slug)).size).toBe(MENU_ITEMS.length);
    expect(new Set(MENU_ITEMS.map((i) => i.id)).size).toBe(MENU_ITEMS.length);
  });
});
