import type { Category, MenuItem, OptionGroup } from "../types";

/**
 * Seed menu.
 *
 * Stand-in for the `categories` and `menu_items` tables — plain typed data with
 * no behaviour attached, so moving it into Postgres later is a change of source,
 * not of shape. See `lib/data/repository.ts`.
 *
 * Prices are VAT-inclusive cents, the way they are quoted on the menu board.
 * Image paths point at `/public/menu/`; real photography drops in under those
 * names with no code change.
 *
 * Every REQUIRED option group carries exactly one `isDefault` option. That is
 * what makes one-tap add-to-cart honest: the card can add a real, fully
 * specified line rather than an incomplete one. See `defaultSelectionsFor`.
 */

export const CATEGORIES: Category[] = [
  {
    id: "cat-burgers",
    slug: "burgers",
    name: "Burgers",
    description: "Smashed daily on the flat top, in a toasted potato bun.",
    sortOrder: 1,
  },
  {
    id: "cat-sandwiches",
    slug: "sandwiches",
    name: "Sandwiches",
    description: "Piled high on bread we bake in-house every morning.",
    sortOrder: 2,
  },
  {
    id: "cat-salads",
    slug: "salads",
    name: "Salads",
    description: "Big, properly dressed, and never an afterthought.",
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
    id: "cat-desserts",
    slug: "desserts",
    name: "Desserts",
    description: "Worth saving room for.",
    sortOrder: 5,
  },
  {
    id: "cat-drinks",
    slug: "drinks",
    name: "Drinks",
    description: "Cold press, cold brew and local taps.",
    sortOrder: 6,
  },
];

/* ── Reusable option groups ───────────────────────────────────────────────────
   Cloned per item rather than shared by reference: a real database joins these
   per item, and each item's availability flags drift independently once staff
   start editing them.
   ────────────────────────────────────────────────────────────────────────── */

const pattyChoice = (): OptionGroup => ({
  id: "grp-patty",
  name: "How hungry are you?",
  selection: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  options: [
    { id: "opt-patty-single", name: "Single patty", priceDelta: 0, available: true, isDefault: true },
    { id: "opt-patty-double", name: "Double patty", priceDelta: 350, available: true },
  ],
});

const burgerExtras = (): OptionGroup => ({
  id: "grp-burger-extras",
  name: "Extras",
  description: "Build it out.",
  selection: "multi",
  required: false,
  minSelections: 0,
  maxSelections: 5,
  options: [
    { id: "opt-ex-cheese", name: "Extra aged cheddar", priceDelta: 120, available: true },
    { id: "opt-ex-bacon", name: "Smoked bacon", priceDelta: 180, available: true },
    { id: "opt-ex-avocado", name: "Avocado", priceDelta: 200, available: true },
    { id: "opt-ex-egg", name: "Fried egg", priceDelta: 150, available: true },
    { id: "opt-ex-jalapeno", name: "Pickled jalapeños", priceDelta: 90, available: true },
  ],
});

const breadChoice = (): OptionGroup => ({
  id: "grp-bread",
  name: "Bread",
  selection: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  options: [
    { id: "opt-bread-sourdough", name: "Toasted sourdough", priceDelta: 0, available: true, isDefault: true },
    { id: "opt-bread-ciabatta", name: "Ciabatta", priceDelta: 0, available: true },
    { id: "opt-bread-gf", name: "Gluten-free roll", priceDelta: 120, available: true },
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
    { id: "opt-pro-chicken", name: "Grilled chicken", priceDelta: 350, available: true },
    { id: "opt-pro-halloumi", name: "Grilled halloumi", priceDelta: 300, available: true },
    { id: "opt-pro-falafel", name: "Crispy falafel", priceDelta: 250, available: true },
  ],
});

const portionSize = (): OptionGroup => ({
  id: "grp-portion",
  name: "Size",
  selection: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  options: [
    { id: "opt-size-regular", name: "Regular", priceDelta: 0, available: true, isDefault: true },
    { id: "opt-size-large", name: "Large", priceDelta: 150, available: true },
  ],
});

export const MENU_ITEMS: MenuItem[] = [
  /* ── Burgers ──────────────────────────────────────────────────────────── */
  {
    id: "itm-classic",
    slug: "urban-classic",
    categoryId: "cat-burgers",
    name: "Urban Classic",
    description:
      "Aged beef, melted cheddar, house pickles, secret sauce, toasted potato bun.",
    basePrice: 1050,
    image: { src: "/menu/urban-classic.jpg", alt: "Classic cheeseburger with melted cheddar and pickles" },
    tags: [],
    allergens: ["gluten", "milk", "egg", "mustard"],
    available: true,
    featured: true,
    kitchenMinutes: 12,
    optionGroups: [pattyChoice(), burgerExtras()],
  },
  {
    id: "itm-bbq-bacon",
    slug: "smoky-bbq-bacon",
    categoryId: "cat-burgers",
    name: "Smoky BBQ Bacon",
    description:
      "Double-smoked bacon, crispy onions, aged cheddar and our own bourbon BBQ sauce.",
    basePrice: 1290,
    image: { src: "/menu/smoky-bbq-bacon.jpg", alt: "Bacon burger stacked with crispy onions" },
    tags: [],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: true,
    kitchenMinutes: 13,
    optionGroups: [pattyChoice(), burgerExtras()],
  },
  {
    id: "itm-crispy-chicken",
    slug: "crispy-chicken-burger",
    categoryId: "cat-burgers",
    name: "Crispy Chicken",
    description:
      "Buttermilk-brined thigh, slaw, sriracha mayo, butter-toasted bun.",
    basePrice: 1150,
    image: { src: "/menu/crispy-chicken.jpg", alt: "Crispy fried chicken burger with slaw" },
    tags: ["spicy"],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: true,
    kitchenMinutes: 14,
    optionGroups: [burgerExtras()],
  },
  {
    id: "itm-truffle-mushroom",
    slug: "truffle-mushroom-swiss",
    categoryId: "cat-burgers",
    name: "Truffle Mushroom Swiss",
    description: "Roast garlic mushrooms, Swiss, truffle aioli, rocket.",
    basePrice: 1350,
    image: { src: "/menu/truffle-mushroom.jpg", alt: "Mushroom and Swiss burger with rocket" },
    tags: [],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 13,
    optionGroups: [pattyChoice(), burgerExtras()],
  },
  {
    id: "itm-garden",
    slug: "garden-burger",
    categoryId: "cat-burgers",
    name: "Garden Burger",
    description:
      "Beetroot and black bean patty, smashed avocado, vegan chipotle mayo.",
    basePrice: 1190,
    image: { src: "/menu/garden-burger.jpg", alt: "Plant-based burger with avocado" },
    tags: ["vegan", "vegetarian"],
    allergens: ["gluten", "soya"],
    available: true,
    featured: false,
    kitchenMinutes: 12,
    optionGroups: [burgerExtras()],
  },

  /* ── Sandwiches ───────────────────────────────────────────────────────── */
  {
    id: "itm-beef-dip",
    slug: "slow-braised-beef-dip",
    categoryId: "cat-sandwiches",
    name: "Slow-Braised Beef Dip",
    description:
      "Six-hour braised chuck, caramelised onion, Gruyère, rich dipping jus.",
    basePrice: 1250,
    image: { src: "/menu/beef-dip.jpg", alt: "Beef dip sandwich with a pot of jus" },
    tags: [],
    allergens: ["gluten", "milk"],
    available: true,
    featured: true,
    kitchenMinutes: 12,
    optionGroups: [breadChoice()],
  },
  {
    id: "itm-chicken-club",
    slug: "grilled-chicken-club",
    categoryId: "cat-sandwiches",
    name: "Grilled Chicken Club",
    description: "Chargrilled chicken, smoked bacon, avocado, herb mayo, tomato.",
    basePrice: 1090,
    image: { src: "/menu/chicken-club.jpg", alt: "Stacked chicken club sandwich" },
    tags: [],
    allergens: ["gluten", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 11,
    optionGroups: [breadChoice()],
  },
  {
    id: "itm-halloumi",
    slug: "halloumi-roasted-pepper",
    categoryId: "cat-sandwiches",
    name: "Halloumi & Roasted Pepper",
    description: "Grilled halloumi, sweet peppers, rocket, basil pesto.",
    basePrice: 990,
    image: { src: "/menu/halloumi.jpg", alt: "Halloumi and roasted pepper sandwich" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk", "nuts"],
    available: true,
    featured: false,
    kitchenMinutes: 10,
    optionGroups: [breadChoice()],
  },

  /* ── Salads ───────────────────────────────────────────────────────────── */
  {
    id: "itm-caesar",
    slug: "chicken-caesar",
    categoryId: "cat-salads",
    name: "Chicken Caesar",
    description:
      "Chargrilled chicken, baby gem, aged parmesan, sourdough croutons, proper Caesar dressing.",
    basePrice: 1150,
    image: { src: "/menu/caesar.jpg", alt: "Chicken Caesar salad with shaved parmesan" },
    tags: [],
    allergens: ["gluten", "milk", "egg", "fish"],
    available: true,
    featured: true,
    kitchenMinutes: 9,
    optionGroups: [],
  },
  {
    id: "itm-quinoa",
    slug: "superfood-quinoa-bowl",
    categoryId: "cat-salads",
    name: "Superfood Quinoa Bowl",
    description:
      "Tricolour quinoa, roast sweet potato, kale, pomegranate, tahini lemon dressing.",
    basePrice: 1090,
    image: { src: "/menu/quinoa-bowl.jpg", alt: "Colourful quinoa and roast vegetable bowl" },
    tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: ["sesame"],
    available: true,
    featured: true,
    kitchenMinutes: 8,
    optionGroups: [addProtein()],
  },
  {
    id: "itm-burrata-salad",
    slug: "burrata-heirloom-tomato",
    categoryId: "cat-salads",
    name: "Burrata & Heirloom Tomato",
    description: "Creamy burrata, heirloom tomatoes, basil, aged balsamic, olive oil.",
    basePrice: 1250,
    image: { src: "/menu/burrata-salad.jpg", alt: "Burrata with sliced heirloom tomatoes" },
    tags: ["vegetarian", "gluten-free"],
    allergens: ["milk"],
    available: true,
    featured: false,
    kitchenMinutes: 7,
    optionGroups: [],
  },

  /* ── Sides ────────────────────────────────────────────────────────────── */
  {
    id: "itm-fries",
    slug: "skin-on-fries",
    categoryId: "cat-sides",
    name: "Skin-On Fries",
    description: "Twice-cooked, rosemary salt.",
    basePrice: 390,
    image: { src: "/menu/fries.jpg", alt: "Golden skin-on fries" },
    tags: ["vegan", "vegetarian"],
    allergens: [],
    available: true,
    featured: false,
    kitchenMinutes: 6,
    optionGroups: [portionSize()],
  },
  {
    id: "itm-truffle-fries",
    slug: "truffle-parmesan-fries",
    categoryId: "cat-sides",
    name: "Truffle Parmesan Fries",
    description: "Truffle oil, aged parmesan, chives.",
    basePrice: 550,
    image: { src: "/menu/truffle-fries.jpg", alt: "Fries topped with parmesan and chives" },
    tags: ["vegetarian"],
    allergens: ["milk"],
    available: true,
    featured: false,
    kitchenMinutes: 6,
    optionGroups: [portionSize()],
  },
  {
    id: "itm-sweet-potato",
    slug: "sweet-potato-fries",
    categoryId: "cat-sides",
    name: "Sweet Potato Fries",
    description: "Crisp outside, sweet inside, chipotle mayo on the side.",
    basePrice: 450,
    image: { src: "/menu/sweet-potato-fries.jpg", alt: "Sweet potato fries with dip" },
    tags: ["vegetarian", "gluten-free"],
    allergens: ["egg"],
    available: true,
    featured: false,
    kitchenMinutes: 7,
    optionGroups: [portionSize()],
  },
  {
    id: "itm-onion-rings",
    slug: "crispy-onion-rings",
    categoryId: "cat-sides",
    name: "Crispy Onion Rings",
    description: "Beer-battered, smoked paprika salt.",
    basePrice: 490,
    image: { src: "/menu/onion-rings.jpg", alt: "Stack of beer-battered onion rings" },
    tags: ["vegetarian"],
    allergens: ["gluten"],
    // Sold out for the evening — stays listed, cannot be ordered.
    available: false,
    featured: false,
    kitchenMinutes: 7,
    optionGroups: [],
  },

  /* ── Desserts ─────────────────────────────────────────────────────────── */
  {
    id: "itm-brownie",
    slug: "salted-caramel-brownie",
    categoryId: "cat-desserts",
    name: "Salted Caramel Brownie",
    description: "Warm, fudgy, salted caramel, vanilla ice cream.",
    basePrice: 590,
    image: { src: "/menu/brownie.jpg", alt: "Warm brownie with ice cream" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 5,
    optionGroups: [],
  },
  {
    id: "itm-cheesecake",
    slug: "new-york-cheesecake",
    categoryId: "cat-desserts",
    name: "New York Cheesecake",
    description: "Dense, vanilla-flecked, macerated berry compote.",
    basePrice: 650,
    image: { src: "/menu/cheesecake.jpg", alt: "Slice of cheesecake with berry compote" },
    tags: ["vegetarian"],
    allergens: ["gluten", "milk", "egg"],
    available: true,
    featured: false,
    kitchenMinutes: 4,
    optionGroups: [],
  },

  /* ── Drinks ───────────────────────────────────────────────────────────── */
  {
    id: "itm-lemonade",
    slug: "craft-lemonade",
    categoryId: "cat-drinks",
    name: "Craft Lemonade",
    description: "Pressed lemon, mint, sparkling water. Not too sweet.",
    basePrice: 390,
    image: { src: "/menu/lemonade.jpg", alt: "Cloudy lemonade over ice with mint" },
    tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: [],
    available: true,
    featured: false,
    kitchenMinutes: 3,
    optionGroups: [],
  },
  {
    id: "itm-cold-brew",
    slug: "cold-brew-coffee",
    categoryId: "cat-drinks",
    name: "Cold Brew Coffee",
    description: "Steeped 18 hours, served over ice. Oat milk on request.",
    basePrice: 420,
    image: { src: "/menu/cold-brew.jpg", alt: "Cold brew coffee over ice" },
    tags: ["vegan", "vegetarian", "gluten-free"],
    allergens: [],
    available: true,
    featured: false,
    kitchenMinutes: 3,
    optionGroups: [],
  },
  {
    id: "itm-craft-beer",
    slug: "local-craft-beer",
    categoryId: "cat-drinks",
    name: "Local Craft Beer",
    description: "Rotating Berlin tap. Ask us what's on.",
    basePrice: 490,
    image: { src: "/menu/craft-beer.jpg", alt: "Glass of pale craft beer" },
    tags: ["vegetarian"],
    allergens: ["gluten"],
    available: true,
    featured: false,
    kitchenMinutes: 2,
    optionGroups: [],
  },
];
