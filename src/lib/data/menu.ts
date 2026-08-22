import type { Category, MenuItem, OptionGroup } from "../types";

/**
 * Seed menu.
 *
 * This is the stand-in for the `categories` and `menu_items` tables. It is
 * plain typed data with no behaviour attached, so moving it into Postgres later
 * is a change of source, not a change of shape — see `lib/data/repository.ts`.
 *
 * Image paths point at `/public/menu/`. Real photography drops in there under
 * the same names with no code change.
 */

export const CATEGORIES: Category[] = [
  {
    id: "cat-small",
    slug: "small-plates",
    name: "Small Plates",
    description: "Snacks and starters built for the middle of the table.",
    sortOrder: 1,
  },
  {
    id: "cat-wood",
    slug: "from-the-wood-oven",
    name: "From the Wood Oven",
    description: "Everything that meets the fire at 800°F.",
    sortOrder: 2,
  },
  {
    id: "cat-pasta",
    slug: "pasta",
    name: "Pasta",
    description: "Rolled and cut in-house every morning.",
    sortOrder: 3,
  },
  {
    id: "cat-sides",
    slug: "sides",
    name: "Sides",
    description: "The supporting cast.",
    sortOrder: 4,
  },
  {
    id: "cat-sweet",
    slug: "desserts",
    name: "Desserts",
    description: "Worth saving room for.",
    sortOrder: 5,
  },
  {
    id: "cat-drinks",
    slug: "drinks",
    name: "Drinks",
    description: "Natural wine, local beer and soft drinks.",
    sortOrder: 6,
  },
];

/* ── Reusable option groups ───────────────────────────────────────────────────
   Shared groups are cloned per item rather than referenced, because a real
   database would join them per item and each item's availability flags drift
   independently once staff start editing them.
   ────────────────────────────────────────────────────────────────────────── */

const pizzaSize = (): OptionGroup => ({
  id: "grp-size",
  name: "Size",
  selection: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  options: [
    { id: "opt-size-10", name: '10" personal', priceDelta: 0, available: true, isDefault: true },
    { id: "opt-size-14", name: '14" sharing', priceDelta: 600, available: true },
  ],
});

const pizzaExtras = (): OptionGroup => ({
  id: "grp-extras",
  name: "Extras",
  description: "Pile it on.",
  selection: "multi",
  required: false,
  minSelections: 0,
  maxSelections: 5,
  options: [
    { id: "opt-ex-burrata", name: "Burrata", priceDelta: 450, available: true },
    { id: "opt-ex-nduja", name: "'Nduja", priceDelta: 350, available: true },
    { id: "opt-ex-mushroom", name: "Roast mushrooms", priceDelta: 250, available: true },
    { id: "opt-ex-chili", name: "Calabrian chili", priceDelta: 150, available: true },
    { id: "opt-ex-anchovy", name: "White anchovy", priceDelta: 300, available: false },
  ],
});

const pastaPortion = (): OptionGroup => ({
  id: "grp-portion",
  name: "Portion",
  selection: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  options: [
    { id: "opt-portion-half", name: "Starter", priceDelta: -400, available: true },
    { id: "opt-portion-full", name: "Main", priceDelta: 0, available: true, isDefault: true },
  ],
});

const addProtein = (): OptionGroup => ({
  id: "grp-protein",
  name: "Add protein",
  selection: "single",
  required: false,
  minSelections: 0,
  maxSelections: 1,
  options: [
    { id: "opt-pro-chicken", name: "Wood-fired chicken", priceDelta: 600, available: true },
    { id: "opt-pro-shrimp", name: "Gulf shrimp", priceDelta: 800, available: true },
    { id: "opt-pro-mushroom", name: "King oyster mushroom", priceDelta: 500, available: true },
  ],
});

const drinkServe = (): OptionGroup => ({
  id: "grp-serve",
  name: "Serve",
  selection: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  options: [
    { id: "opt-serve-glass", name: "Glass", priceDelta: 0, available: true, isDefault: true },
    { id: "opt-serve-bottle", name: "Bottle", priceDelta: 2600, available: true },
  ],
});

export const MENU_ITEMS: MenuItem[] = [
  /* ── Small plates ─────────────────────────────────────────────────────── */
  {
    id: "itm-focaccia",
    slug: "rosemary-focaccia",
    categoryId: "cat-small",
    name: "Rosemary Focaccia",
    description:
      "Slow-proved for 24 hours, finished with Sicilian olive oil and flaky salt.",
    basePrice: 700,
    image: { src: "/menu/focaccia.jpg", alt: "Golden rosemary focaccia torn into pieces" },
    tags: ["vegetarian", "vegan"],
    allergens: ["gluten"],
    available: true,
    featured: false,
    kitchenMinutes: 8,
    optionGroups: [
      {
        id: "grp-dip",
        name: "Add a dip",
        selection: "multi",
        required: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { id: "opt-dip-whipped", name: "Whipped ricotta", priceDelta: 300, available: true },
          { id: "opt-dip-tapenade", name: "Olive tapenade", priceDelta: 250, available: true },
        ],
      },
    ],
  },
  {
    id: "itm-burrata",
    slug: "burrata-and-peaches",
    categoryId: "cat-small",
    name: "Burrata & Peaches",
    description:
      "Puglian burrata, grilled Georgia peaches, basil, aged balsamic, toasted pistachio.",
    basePrice: 1600,
    image: { src: "/menu/burrata.jpg", alt: "Creamy burrata with grilled peach wedges" },
    tags: ["vegetarian", "contains-nuts", "gluten-free"],
    allergens: ["milk", "nuts"],
    available: true,
    featured: true,
    kitchenMinutes: 10,
    optionGroups: [],
  },
  {
    id: "itm-meatballs",
    slug: "wood-fired-meatballs",
    categoryId: "cat-small",
    name: "Wood-Fired Meatballs",
    description: "Beef and pork, San Marzano sugo, pecorino, grilled sourdough.",
    basePrice: 1400,
    image: { src: "/menu/meatballs.jpg", alt: "Meatballs in tomato sugo topped with pecorino" },
    tags: ["spicy"],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 14,
    optionGroups: [],
  },

  /* ── Wood oven ────────────────────────────────────────────────────────── */
  {
    id: "itm-margherita",
    slug: "margherita",
    categoryId: "cat-wood",
    name: "Margherita",
    description:
      "San Marzano, fior di latte, basil, olive oil. The one we judge ourselves by.",
    basePrice: 1500,
    image: { src: "/menu/margherita.jpg", alt: "Blistered margherita pizza with fresh basil" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk"],
    available: true,
    featured: true,
    kitchenMinutes: 12,
    optionGroups: [pizzaSize(), pizzaExtras()],
  },
  {
    id: "itm-diavola",
    slug: "diavola",
    categoryId: "cat-wood",
    name: "Diavola",
    description: "Spicy soppressata, Calabrian chili, honey, fior di latte, oregano.",
    basePrice: 1800,
    image: { src: "/menu/diavola.jpg", alt: "Diavola pizza with curled spicy salami" },
    tags: ["spicy"],
    allergens: ["gluten", "milk"],
    available: true,
    featured: true,
    kitchenMinutes: 12,
    optionGroups: [pizzaSize(), pizzaExtras()],
  },
  {
    id: "itm-funghi",
    slug: "funghi-bianca",
    categoryId: "cat-wood",
    name: "Funghi Bianca",
    description:
      "No tomato. Roast maitake and cremini, taleggio, thyme, garlic cream, truffle oil.",
    basePrice: 1900,
    image: { src: "/menu/funghi.jpg", alt: "White pizza covered in roasted mushrooms" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk"],
    available: true,
    featured: false,
    kitchenMinutes: 13,
    optionGroups: [pizzaSize(), pizzaExtras()],
  },
  {
    id: "itm-half-chicken",
    slug: "wood-fired-half-chicken",
    categoryId: "cat-wood",
    name: "Wood-Fired Half Chicken",
    description:
      "Brined 12 hours, charred over oak, salsa verde and a wedge of lemon.",
    basePrice: 2600,
    image: { src: "/menu/chicken.jpg", alt: "Charred half chicken with salsa verde" },
    tags: ["gluten-free"],
    allergens: [],
    available: true,
    featured: false,
    kitchenMinutes: 25,
    optionGroups: [],
  },

  /* ── Pasta ────────────────────────────────────────────────────────────── */
  {
    id: "itm-cacio",
    slug: "cacio-e-pepe",
    categoryId: "cat-pasta",
    name: "Cacio e Pepe",
    description: "Tonnarelli, pecorino romano, black pepper, nothing else. On purpose.",
    basePrice: 1900,
    image: { src: "/menu/cacio.jpg", alt: "Twirled tonnarelli coated in pecorino sauce" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: true,
    kitchenMinutes: 15,
    optionGroups: [pastaPortion(), addProtein()],
  },
  {
    id: "itm-ragu",
    slug: "short-rib-pappardelle",
    categoryId: "cat-pasta",
    name: "Short Rib Pappardelle",
    description: "Six-hour braise, red wine, gremolata, shaved parmigiano.",
    basePrice: 2400,
    image: { src: "/menu/pappardelle.jpg", alt: "Wide pappardelle ribbons in dark short rib ragu" },
    tags: [],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 16,
    optionGroups: [pastaPortion()],
  },
  {
    id: "itm-vongole",
    slug: "linguine-alle-vongole",
    categoryId: "cat-pasta",
    name: "Linguine alle Vongole",
    description: "Littleneck clams, white wine, chili, parsley, breadcrumb.",
    basePrice: 2500,
    image: { src: "/menu/vongole.jpg", alt: "Linguine with clams in their shells" },
    tags: ["spicy"],
    allergens: ["gluten", "molluscs"],
    // Sold out for the evening — stays listed, cannot be ordered.
    available: false,
    featured: false,
    kitchenMinutes: 16,
    optionGroups: [pastaPortion()],
  },

  /* ── Sides ────────────────────────────────────────────────────────────── */
  {
    id: "itm-greens",
    slug: "charred-greens",
    categoryId: "cat-sides",
    name: "Charred Greens",
    description: "Broccolini, garlic, lemon, chili flake, olive oil.",
    basePrice: 900,
    image: { src: "/menu/greens.jpg", alt: "Charred broccolini with lemon" },
    tags: ["vegan", "vegetarian", "gluten-free", "spicy"],
    allergens: [],
    available: true,
    featured: false,
    kitchenMinutes: 8,
    optionGroups: [],
  },
  {
    id: "itm-potatoes",
    slug: "oven-potatoes",
    categoryId: "cat-sides",
    name: "Oven Potatoes",
    description: "Crushed, twice-cooked, rosemary salt, aioli.",
    basePrice: 800,
    image: { src: "/menu/potatoes.jpg", alt: "Crispy crushed potatoes with aioli" },
    tags: ["vegetarian", "gluten-free"],
    allergens: ["egg"],
    available: true,
    featured: false,
    kitchenMinutes: 10,
    optionGroups: [],
  },

  /* ── Desserts ─────────────────────────────────────────────────────────── */
  {
    id: "itm-tiramisu",
    slug: "tiramisu",
    categoryId: "cat-sweet",
    name: "Tiramisù",
    description: "Mascarpone, espresso, savoiardi, cocoa. Made this morning.",
    basePrice: 1100,
    image: { src: "/menu/tiramisu.jpg", alt: "Dusted tiramisù in a glass dish" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 5,
    optionGroups: [],
  },
  {
    id: "itm-affogato",
    slug: "affogato",
    categoryId: "cat-sweet",
    name: "Affogato",
    description: "Fior di latte gelato drowned in a double espresso.",
    basePrice: 900,
    image: { src: "/menu/affogato.jpg", alt: "Espresso poured over white gelato" },
    tags: ["vegetarian", "gluten-free"],
    allergens: ["milk"],
    available: true,
    featured: false,
    kitchenMinutes: 4,
    optionGroups: [
      {
        id: "grp-liqueur",
        name: "Make it a nightcap",
        selection: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          { id: "opt-liq-amaretto", name: "Amaretto", priceDelta: 700, available: true },
          { id: "opt-liq-frangelico", name: "Frangelico", priceDelta: 700, available: true },
        ],
      },
    ],
  },

  /* ── Drinks ───────────────────────────────────────────────────────────── */
  {
    id: "itm-red",
    slug: "natural-red",
    categoryId: "cat-drinks",
    name: "Natural Red",
    description: "Rotating pour. Ask us what's open — usually something from Etna.",
    basePrice: 1400,
    image: { src: "/menu/red-wine.jpg", alt: "A glass of red wine on a dark table" },
    tags: ["vegan", "gluten-free"],
    allergens: ["sulphites"],
    available: true,
    featured: false,
    kitchenMinutes: 2,
    optionGroups: [drinkServe()],
  },
  {
    id: "itm-lemonade",
    slug: "burnt-lemonade",
    categoryId: "cat-drinks",
    name: "Burnt Lemonade",
    description: "Grilled lemon, rosemary syrup, soda. Zero proof.",
    basePrice: 600,
    image: { src: "/menu/lemonade.jpg", alt: "Cloudy lemonade over ice with rosemary" },
    tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: [],
    available: true,
    featured: false,
    kitchenMinutes: 3,
    optionGroups: [],
  },
];
