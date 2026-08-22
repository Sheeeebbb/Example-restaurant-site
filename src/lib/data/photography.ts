/**
 * The photography manifest.
 *
 * Every dish on the menu needs one photograph, and this file is the record of
 * what that photograph must show, how it must be shot, and where the current
 * file came from. It exists so that:
 *
 *   • whoever sources or shoots the images knows exactly what each frame needs,
 *     and the set comes back looking like one session rather than twenty-six;
 *   • a temporary stock photograph can be swapped for the restaurant's own
 *     without anyone having to work out which file was which;
 *   • licence and attribution are recorded next to the image rather than in
 *     somebody's inbox.
 *
 * `credit: null` means the photograph has not been sourced yet. Filling it in is
 * the only bookkeeping a swap requires — the file itself just goes into
 * `public/menu/` under the name in `file`, and the site picks it up.
 *
 * Nothing here is rendered as decoration: `photoCredit()` supplies attribution
 * where a licence requires it.
 */

/* ── House style ──────────────────────────────────────────────────────────── */

/**
 * The rules that make twenty-six separate photographs look like one shoot.
 * Quoted verbatim to a photographer or applied as a retouching brief.
 */
export const HOUSE_STYLE = {
  aspectRatio: "4:3",
  minimumWidth: 1200,
  lighting:
    "Single soft key from the back left, white bounce fill on the right. No on-camera flash, no hard specular highlights on the food.",
  colourTemperature:
    "Warm neutral, roughly 5200K. Whites stay white; no amber cast, no cold blue shadows.",
  background:
    "Matte warm-grey or pale oak surface, evenly lit, falling gently out of focus. No props competing with the dish, no branded packaging, no cutlery unless the dish needs it.",
  depthOfField:
    "Shallow but not extreme — the front of the dish sharp, the background softened. Around f/4 equivalent.",
  framing:
    "The dish fills roughly two thirds of the frame and sits centred, with even margin. Crop to 4:3 without cutting the dish.",
  finishing:
    "Correct exposure and white balance, gentle contrast, restrained sharpening, noise cleaned up. No heavy vignettes, no orange-and-teal grading, no plastic-looking texture.",
} as const;

/* ── Types ────────────────────────────────────────────────────────────────── */

/** Where a photograph came from, and on what terms it may be used. */
export interface PhotoCredit {
  /** "Urban Table" once it is the restaurant's own photography. */
  source: string;
  /** Where the file was obtained, for re-checking the licence later. */
  url?: string;
  photographer?: string;
  /** e.g. "Unsplash License", "CC BY-SA 4.0", "© Urban Table — all rights reserved". */
  licence: string;
  /** True when the licence obliges us to display the credit on the page. */
  attributionRequired: boolean;
  addedOn?: string;
}

export type Composition = "three-quarter" | "overhead" | "straight-on";

export interface PhotoBrief {
  /** Matches the menu item's slug. Kept in sync by a test. */
  slug: string;
  /** Filename under `public/menu/`, matching the item's `image.src`. */
  file: string;
  /** What has to be in the frame. */
  subject: string;
  composition: Composition;
  /**
   * Ingredients that must be visible — these are the dish. A photograph missing
   * them is the wrong photograph.
   */
  mustShow: string[];
  /**
   * Things that must NOT appear. Mostly paid extras and optional add-ons:
   * showing them makes the picture advertise a dish the customer is not buying.
   */
  mustNotShow: string[];
  /** null until a photograph has been sourced. */
  credit: PhotoCredit | null;
}

/* ── Briefs ───────────────────────────────────────────────────────────────── */

const brief = (
  slug: string,
  file: string,
  subject: string,
  composition: Composition,
  mustShow: string[],
  mustNotShow: string[] = [],
): PhotoBrief => ({ slug, file, subject, composition, mustShow, mustNotShow, credit: null });

/**
 * Burgers and sandwiches are shot at three-quarter so the build reads as layers.
 * Salads and bowls go overhead, where the contents are the point. Drinks are
 * straight-on so the glass keeps its proportions.
 */
export const PHOTO_BRIEFS: PhotoBrief[] = [
  /* Burgers */
  brief("urban-classic", "urban-classic.jpg",
    "Single beef patty cheeseburger in a toasted potato bun, cut side of pickles visible.",
    "three-quarter", ["aged beef patty", "melted cheddar", "house pickles", "toasted potato bun"],
    ["bacon", "second patty", "avocado", "fried egg"]),
  brief("smoky-bbq-bacon", "smoky-bbq-bacon.jpg",
    "Bacon cheeseburger with crispy onions spilling from the bun and BBQ sauce visible at the edge.",
    "three-quarter", ["double-smoked bacon", "crispy onions", "aged cheddar", "BBQ sauce"],
    ["second patty", "avocado"]),
  brief("double-smash-deluxe", "double-smash.jpg",
    "Two thin smashed patties stacked with double cheddar, grilled onion and pickles.",
    "three-quarter", ["two thin smashed patties", "double cheddar", "grilled onion", "pickles"],
    ["bacon", "avocado"]),
  brief("crispy-chicken-burger", "crispy-chicken.jpg",
    "Buttermilk-fried chicken thigh in a butter-toasted bun with slaw and sriracha mayo.",
    "three-quarter", ["crispy chicken thigh", "slaw", "sriracha mayo", "butter-toasted bun"],
    ["beef patty", "bacon"]),
  brief("truffle-mushroom-swiss", "truffle-mushroom.jpg",
    "Beef burger topped with roast garlic mushrooms and melted Swiss, rocket at the edge.",
    "three-quarter", ["roast garlic mushrooms", "melted Swiss", "rocket"], ["bacon", "cheddar"]),
  brief("garden-burger", "garden-burger.jpg",
    "Beetroot and black bean patty with smashed avocado and vegan chipotle mayo.",
    "three-quarter", ["beetroot and black bean patty", "smashed avocado", "chipotle mayo"],
    ["any meat", "dairy cheese", "fried egg"]),

  /* Sandwiches */
  brief("slow-braised-beef-dip", "beef-dip.jpg",
    "Braised beef sandwich on toasted sourdough beside a small pot of dipping jus.",
    "three-quarter", ["braised chuck", "caramelised onion", "Gruyère", "pot of jus"], []),
  brief("grilled-chicken-club", "chicken-club.jpg",
    "Stacked club sandwich cut on the diagonal, layers facing the camera.",
    "three-quarter", ["chargrilled chicken", "smoked bacon", "avocado", "tomato"], []),
  brief("halloumi-roasted-pepper", "halloumi.jpg",
    "Grilled halloumi and roasted red pepper sandwich with rocket and pesto.",
    "three-quarter", ["grilled halloumi", "roasted peppers", "rocket", "basil pesto"], ["any meat"]),
  brief("buttermilk-chicken-wrap", "chicken-wrap.jpg",
    "Soft tortilla wrap cut in half, both halves standing so the filling shows.",
    "three-quarter", ["crispy chicken", "baby gem", "pickled chilli", "ranch"], []),

  /* Salads */
  brief("chicken-caesar", "caesar.jpg",
    "Caesar salad in a wide shallow bowl, sliced chargrilled chicken across the top.",
    "overhead", ["chargrilled chicken", "baby gem", "shaved parmesan", "sourdough croutons"],
    ["salmon", "halloumi", "falafel"]),
  brief("superfood-quinoa-bowl", "quinoa-bowl.jpg",
    "Quinoa bowl with roast sweet potato, kale and pomegranate, dressing drizzled.",
    "overhead", ["tricolour quinoa", "roast sweet potato", "kale", "pomegranate"],
    ["chicken", "salmon", "halloumi"]),
  brief("burrata-heirloom-tomato", "burrata-salad.jpg",
    "Whole burrata torn open among sliced heirloom tomatoes, basil and balsamic.",
    "overhead", ["burrata", "heirloom tomatoes", "basil", "aged balsamic"], ["any meat"]),
  brief("hot-smoked-salmon-bowl", "salmon-bowl.jpg",
    "Rice bowl with flaked hot-smoked salmon, edamame, cucumber and avocado.",
    "overhead", ["hot-smoked salmon", "brown rice", "edamame", "cucumber", "avocado"], []),

  /* Sides */
  brief("skin-on-fries", "fries.jpg",
    "Skin-on fries piled in a small metal basket or shallow bowl, rosemary salt visible.",
    "three-quarter", ["skin-on fries", "rosemary salt"], ["cheese", "truffle", "parmesan"]),
  brief("truffle-parmesan-fries", "truffle-fries.jpg",
    "Fries under grated parmesan and chopped chives, truffle oil sheen.",
    "three-quarter", ["fries", "grated parmesan", "chives"], []),
  brief("sweet-potato-fries", "sweet-potato-fries.jpg",
    "Sweet potato fries with a ramekin of chipotle mayo beside them.",
    "three-quarter", ["sweet potato fries", "chipotle mayo on the side"], []),
  brief("buttermilk-slaw", "slaw.jpg",
    "Buttermilk slaw in a small bowl, dill visible through the dressing.",
    "overhead", ["white cabbage", "carrot", "dill", "buttermilk dressing"], []),
  brief("crispy-onion-rings", "onion-rings.jpg",
    "Stack of beer-battered onion rings, paprika salt visible on the batter.",
    "three-quarter", ["beer-battered onion rings", "smoked paprika salt"], []),

  /* Desserts */
  brief("salted-caramel-brownie", "brownie.jpg",
    "Warm brownie square with salted caramel and flaked sea salt on top.",
    "three-quarter", ["fudgy brownie", "salted caramel", "sea salt"],
    ["ice cream", "any scoop"]),
  brief("new-york-cheesecake", "cheesecake.jpg",
    "Slice of dense baked cheesecake with berry compote spooned over one edge.",
    "three-quarter", ["baked cheesecake slice", "berry compote"], []),
  brief("vanilla-soft-serve", "soft-serve.jpg",
    "Vanilla soft serve swirl in a plain cup.",
    "straight-on", ["vanilla soft serve swirl"],
    ["waffle cone", "hot fudge", "sprinkles", "caramel sauce"]),

  /* Drinks */
  brief("craft-lemonade", "lemonade.jpg",
    "Tall glass of cloudy lemonade over ice with a mint sprig.",
    "straight-on", ["cloudy lemonade", "ice", "mint"], []),
  brief("cold-brew-coffee", "cold-brew.jpg",
    "Glass of cold brew over ice, no milk poured in.",
    "straight-on", ["cold brew coffee", "ice"], ["milk swirl", "oat milk"]),
  brief("local-craft-beer", "craft-beer.jpg",
    "Glass of pale craft beer with a settled head.",
    "straight-on", ["pale beer", "head"], ["branded glassware", "brewery logos"]),
  brief("spring-water", "water.jpg",
    "Chilled bottle of spring water with condensation, glass beside it.",
    "straight-on", ["water bottle", "condensation"], ["visible third-party brand marks"]),
];

/**
 * The homepage hero.
 *
 * Not a dish, so it is kept out of `PHOTO_BRIEFS` — which is checked one-to-one
 * against the menu — but it is food imagery and gets the same house style, so
 * the homepage does not look like it came from a different shoot.
 */
export const HERO_BRIEF: PhotoBrief = {
  slug: "__hero",
  file: "hero.jpg",
  subject:
    "Signature burger and fries together on a board, shot slightly closer than the menu frames so it holds a large panel. Same surface and lighting as the dish photography.",
  composition: "three-quarter",
  mustShow: ["a burger from the menu", "skin-on fries"],
  mustNotShow: ["dishes not on the menu", "branded packaging"],
  credit: null,
};

/* ── Lookups ──────────────────────────────────────────────────────────────── */

const BY_SLUG = new Map(PHOTO_BRIEFS.map((entry) => [entry.slug, entry]));

export function photoBrief(slug: string): PhotoBrief | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * The credit to display beneath a photograph, or null when none is required.
 *
 * Stock licences differ: some oblige attribution, most of the permissive ones
 * do not, and the restaurant's own photography never does. Reading the flag
 * rather than assuming keeps us compliant without cluttering every card.
 */
export function photoCredit(slug: string): PhotoCredit | null {
  const entry = BY_SLUG.get(slug);
  if (!entry?.credit) return null;
  return entry.credit.attributionRequired ? entry.credit : null;
}

/** Dishes still waiting on a photograph. Drives `npm run photos:check`. */
export function unsourcedSlugs(): string[] {
  return PHOTO_BRIEFS.filter((entry) => entry.credit === null).map((e) => e.slug);
}
