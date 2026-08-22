import type { MenuOption, OptionGroup } from "../types";

/**
 * The shared customisation library.
 *
 * Customisation is DATA, not per-product code. Nothing in the app branches on
 * "is this a burger?" — a product declares which groups it offers, and one
 * generic customiser renders, validates, and prices whatever it finds. Adding a
 * new dish means composing groups here; adding a new *kind* of choice means
 * adding one factory to this file. Neither touches a component.
 *
 * Each factory returns a FRESH object rather than a shared constant. Two items
 * offering "Extras" get independent copies, because a real database joins these
 * per item and staff will eventually mark an option sold out on one dish
 * without meaning to change every other dish that offers it.
 *
 * Conventions the customiser relies on:
 *   • A `required` group must contain exactly one available `isDefault` option,
 *     so the item can still be added in one tap from a menu card.
 *   • `priceDelta` is signed and in cents. Zero is normal — a size that costs
 *     the same, a sauce that's included, an ingredient removed.
 */

/* ── Size ─────────────────────────────────────────────────────────────────── */

/** Portion size for sides, drinks and anything else sold in two sizes. */
export function portionSize(largeDelta = 150): OptionGroup {
  return {
    id: "grp-size",
    name: "Size",
    selection: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: "opt-size-regular", name: "Regular", priceDelta: 0, available: true, isDefault: true },
      { id: "opt-size-large", name: "Large", priceDelta: largeDelta, available: true },
    ],
  };
}

/* ── Burgers ──────────────────────────────────────────────────────────────── */

/** How the kitchen should cook a beef patty. Required, because it changes the dish. */
export function cookTemperature(): OptionGroup {
  return {
    id: "grp-cook",
    name: "How would you like it cooked?",
    selection: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: "opt-cook-medium", name: "Medium", priceDelta: 0, available: true, isDefault: true },
      { id: "opt-cook-medium-well", name: "Medium well", priceDelta: 0, available: true },
      { id: "opt-cook-well", name: "Well done", priceDelta: 0, available: true },
    ],
  };
}

/**
 * Paid additions.
 *
 * `exclude` drops options that make no sense on a given dish — bacon on the
 * vegan burger, an extra beef patty on the chicken one — so the same factory
 * still serves items that offer *most* of the list.
 */
export function extras(exclude: string[] = []): OptionGroup {
  const all: MenuOption[] = [
    { id: "opt-ex-cheese", name: "Extra cheese", priceDelta: 150, available: true },
    { id: "opt-ex-bacon", name: "Bacon", priceDelta: 200, available: true },
    { id: "opt-ex-avocado", name: "Avocado", priceDelta: 200, available: true },
    { id: "opt-ex-patty", name: "Extra patty", priceDelta: 400, available: true },
    { id: "opt-ex-egg", name: "Fried egg", priceDelta: 150, available: true },
    { id: "opt-ex-jalapeno", name: "Pickled jalapeños", priceDelta: 100, available: true },
  ];

  return {
    id: "grp-extras",
    name: "Extras",
    description: "Build it out. Add as many as you like.",
    selection: "multi",
    required: false,
    minSelections: 0,
    maxSelections: 6,
    options: all.filter((option) => !exclude.includes(option.id)),
  };
}

/* ── Sauces ───────────────────────────────────────────────────────────────── */

/** Included sauces, capped at two so the kitchen isn't asked for all six. */
export function sauces(): OptionGroup {
  return {
    id: "grp-sauce",
    name: "Sauces",
    // No "none" option: this group is optional and multi-select, so clearing
    // every sauce already expresses "no sauce" without a contradictory choice
    // that could be ticked alongside a real one.
    description: "Included — pick up to two.",
    selection: "multi",
    required: false,
    minSelections: 0,
    maxSelections: 2,
    options: [
      { id: "opt-sauce-house", name: "House burger sauce", priceDelta: 0, available: true, isDefault: true },
      { id: "opt-sauce-aioli", name: "Garlic aioli", priceDelta: 0, available: true },
      { id: "opt-sauce-chipotle", name: "Chipotle mayo", priceDelta: 0, available: true },
      { id: "opt-sauce-bbq", name: "Bourbon BBQ", priceDelta: 0, available: true },
      { id: "opt-sauce-sriracha", name: "Sriracha mayo", priceDelta: 0, available: true },
    ],
  };
}

/* ── Ingredient modifications ─────────────────────────────────────────────── */

/**
 * Things to leave out.
 *
 * Free, and modelled as ordinary options rather than a separate concept: the
 * kitchen ticket reads the same either way, and the customiser needs no special
 * case for them.
 */
export function removals(items: { id: string; name: string }[]): OptionGroup {
  return {
    id: "grp-remove",
    name: "Anything to leave out?",
    selection: "multi",
    required: false,
    minSelections: 0,
    maxSelections: items.length,
    options: items.map((item) => ({
      id: item.id,
      name: item.name,
      priceDelta: 0,
      available: true,
    })),
  };
}

/** The removals offered on most burgers and sandwiches. */
export function standardRemovals(): OptionGroup {
  return removals([
    { id: "opt-no-pickles", name: "No pickles" },
    { id: "opt-no-onion", name: "No onion" },
    { id: "opt-no-lettuce", name: "No lettuce" },
    { id: "opt-no-tomato", name: "No tomato" },
  ]);
}

/* ── Sandwiches ───────────────────────────────────────────────────────────── */

export function breadChoice(): OptionGroup {
  return {
    id: "grp-bread",
    name: "Bread",
    selection: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: "opt-bread-sourdough", name: "Toasted sourdough", priceDelta: 0, available: true, isDefault: true },
      { id: "opt-bread-ciabatta", name: "Ciabatta", priceDelta: 0, available: true },
      { id: "opt-bread-brioche", name: "Brioche bun", priceDelta: 0, available: true },
      { id: "opt-bread-gf", name: "Gluten-free roll", priceDelta: 120, available: true },
    ],
  };
}

/* ── Salads ───────────────────────────────────────────────────────────────── */

export function addProtein(): OptionGroup {
  return {
    id: "grp-protein",
    name: "Add protein",
    selection: "single",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    options: [
      { id: "opt-pro-chicken", name: "Grilled chicken", priceDelta: 395, available: true },
      { id: "opt-pro-halloumi", name: "Grilled halloumi", priceDelta: 350, available: true },
      { id: "opt-pro-falafel", name: "Crispy falafel", priceDelta: 295, available: true },
      { id: "opt-pro-salmon", name: "Hot-smoked salmon", priceDelta: 550, available: true },
    ],
  };
}

export function dressing(options: { id: string; name: string }[]): OptionGroup {
  return {
    id: "grp-dressing",
    name: "Dressing",
    selection: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      ...options.map((option, index) => ({
        id: option.id,
        name: option.name,
        priceDelta: 0,
        available: true,
        isDefault: index === 0,
      })),
      { id: "opt-dressing-side", name: "On the side", priceDelta: 0, available: true },
      { id: "opt-dressing-none", name: "No dressing", priceDelta: 0, available: true },
    ],
  };
}

/* ── Upsells ──────────────────────────────────────────────────────────────── */

/** Fries and a drink alongside a main. Optional, so it never blocks add-to-cart. */
export function makeItAMeal(): OptionGroup {
  return {
    id: "grp-meal",
    name: "Make it a meal",
    description: "Add fries and a drink.",
    selection: "single",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    options: [
      { id: "opt-meal-fries", name: "Skin-on fries & a soft drink", priceDelta: 450, available: true },
      { id: "opt-meal-truffle", name: "Truffle fries & a soft drink", priceDelta: 650, available: true },
    ],
  };
}

/** Ice cream alongside a warm dessert. */
export function dessertAddOn(): OptionGroup {
  return {
    id: "grp-dessert-add",
    name: "Add a scoop",
    selection: "single",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    options: [
      { id: "opt-scoop-vanilla", name: "Vanilla ice cream", priceDelta: 250, available: true },
      { id: "opt-scoop-salted", name: "Salted caramel ice cream", priceDelta: 250, available: true },
    ],
  };
}

/** Milk choice for coffee. */
export function milkChoice(): OptionGroup {
  return {
    id: "grp-milk",
    name: "Milk",
    selection: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: "opt-milk-whole", name: "Whole milk", priceDelta: 0, available: true, isDefault: true },
      { id: "opt-milk-oat", name: "Oat milk", priceDelta: 50, available: true },
      { id: "opt-milk-none", name: "Black", priceDelta: 0, available: true },
    ],
  };
}
