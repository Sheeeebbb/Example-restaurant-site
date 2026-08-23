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

/**
 * Where the current photograph for each dish came from.
 *
 * One block, one entry per file, so replacing the temporary stock photography
 * with the restaurant's own is a single edit here plus a new file in
 * `public/menu/` — no hunting through the briefs below.
 *
 * A slug missing from this map has no photograph yet, and `credit` stays null.
 */
const CREDITS: Record<string, PhotoCredit> = {
  "urban-classic": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5970025/cheeseburger-fries-ketchup",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "smoky-bbq-bacon": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5968248/burger-bun",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "double-smash-deluxe": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5923478/free-burger-image-public-domain-food-cc0-photo",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "crispy-chicken-burger": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/3304030/free-photo-image-sandwiches-olive-fried-fries",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "truffle-mushroom-swiss": {
    source: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/index.php?curid=156085289",
    photographer: "JIP",
    licence: "CC BY-SA 4.0",
    attributionRequired: true,
    addedOn: "2026-08-22",
  },
  "garden-burger": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/11524474/photo-image-burger-public-domain-tomatoes",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "slow-braised-beef-dip": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/448380/free-photo-image-sandwich-burger-burger-restaurant",
    photographer: "Jakub Kapusnak",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "grilled-chicken-club": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5926616/photo-image-public-domain-food-free",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "halloumi-roasted-pepper": {
    source: "StockSnap.io",
    url: "https://stocksnap.io/photo/bread-sandwich-J2S35LH7Z1",
    photographer: "Freestocks.org",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "buttermilk-chicken-wrap": {
    source: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/index.php?curid=130489661",
    photographer: "Andy Li",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "chicken-caesar": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5969607/chicken-salad",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "superfood-quinoa-bowl": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5921341/photo-image-flower-public-domain-plant",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "burrata-heirloom-tomato": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5906980/photo-image-public-domain-food-free",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "skin-on-fries": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5901512/free-french-fries-image-public-domain-cc0-photo",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "truffle-parmesan-fries": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5925861/photo-image-public-domain-food-free",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "sweet-potato-fries": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/448046/free-photo-image-sweet-potato-appetite-cc0",
    photographer: "Jakub Kapusnak",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "buttermilk-slaw": {
    source: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/index.php?curid=5908746",
    photographer: "BrokenSphere",
    licence: "CC BY-SA 3.0",
    attributionRequired: true,
    addedOn: "2026-08-22",
  },
  "crispy-onion-rings": {
    source: "WordPress Photo Directory",
    url: "https://wordpress.org/photos/photo/35369ce104/",
    photographer: "Mohammed Kateregga",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "salted-caramel-brownie": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5903810/photo-image-background-public-domain-food",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "new-york-cheesecake": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5924639/photo-image-public-domain-illustration-fruit",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "vanilla-soft-serve": {
    source: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/index.php?curid=130153111",
    photographer: "Marius Vassnes",
    licence: "CC BY-SA 4.0",
    attributionRequired: true,
    addedOn: "2026-08-22",
  },
  "craft-lemonade": {
    source: "StockSnap.io",
    url: "https://stocksnap.io/photo/summer-cocktail-HGO20PXZVV",
    photographer: "Tim Sullivan",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "cold-brew-coffee": {
    source: "Rawpixel",
    url: "https://www.rawpixel.com/image/5974765/cold-coffee-americano-rocks",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "local-craft-beer": {
    source: "WordPress Photo Directory",
    url: "https://wordpress.org/photos/photo/654663252b/",
    photographer: "Nilo Velez",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
  "spring-water": {
    source: "WordPress Photo Directory",
    url: "https://wordpress.org/photos/photo/5116795c83/",
    photographer: "Yam B Chhetri",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
};

const brief = (
  slug: string,
  file: string,
  subject: string,
  composition: Composition,
  mustShow: string[],
  mustNotShow: string[] = [],
): PhotoBrief => ({
  slug,
  file,
  subject,
  composition,
  mustShow,
  mustNotShow,
  credit: CREDITS[slug] ?? null,
});

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
  brief("double-smash-deluxe", "double-smash-deluxe.jpg",
    "Two thin smashed patties stacked with double cheddar, grilled onion and pickles.",
    "three-quarter", ["two thin smashed patties", "double cheddar", "grilled onion", "pickles"],
    ["bacon", "avocado"]),
  brief("crispy-chicken-burger", "crispy-chicken-burger.jpg",
    "Buttermilk-fried chicken thigh in a butter-toasted bun with slaw and sriracha mayo.",
    "three-quarter", ["crispy chicken thigh", "slaw", "sriracha mayo", "butter-toasted bun"],
    ["beef patty", "bacon"]),
  brief("truffle-mushroom-swiss", "truffle-mushroom-swiss.jpg",
    "Beef burger topped with roast garlic mushrooms and melted Swiss, rocket at the edge.",
    "three-quarter", ["roast garlic mushrooms", "melted Swiss", "rocket"], ["bacon", "cheddar"]),
  brief("garden-burger", "garden-burger.jpg",
    "Beetroot and black bean patty with smashed avocado and vegan chipotle mayo.",
    "three-quarter", ["beetroot and black bean patty", "smashed avocado", "chipotle mayo"],
    ["any meat", "dairy cheese", "fried egg"]),

  /* Sandwiches */
  brief("slow-braised-beef-dip", "slow-braised-beef-dip.jpg",
    "Braised beef sandwich on toasted sourdough beside a small pot of dipping jus.",
    "three-quarter", ["braised chuck", "caramelised onion", "Gruyère", "pot of jus"], []),
  brief("grilled-chicken-club", "grilled-chicken-club.jpg",
    "Stacked club sandwich cut on the diagonal, layers facing the camera.",
    "three-quarter", ["chargrilled chicken", "smoked bacon", "avocado", "tomato"], []),
  brief("halloumi-roasted-pepper", "halloumi-roasted-pepper.jpg",
    "Grilled halloumi and roasted red pepper sandwich with rocket and pesto.",
    "three-quarter", ["grilled halloumi", "roasted peppers", "rocket", "basil pesto"], ["any meat"]),
  brief("buttermilk-chicken-wrap", "buttermilk-chicken-wrap.jpg",
    "Soft tortilla wrap cut in half, both halves standing so the filling shows.",
    "three-quarter", ["crispy chicken", "baby gem", "pickled chilli", "ranch"], []),

  /* Salads */
  brief("chicken-caesar", "chicken-caesar.jpg",
    "Caesar salad in a wide shallow bowl, sliced chargrilled chicken across the top.",
    "overhead", ["chargrilled chicken", "baby gem", "shaved parmesan", "sourdough croutons"],
    ["salmon", "halloumi", "falafel"]),
  brief("superfood-quinoa-bowl", "superfood-quinoa-bowl.jpg",
    "Quinoa bowl with roast sweet potato, kale and pomegranate, dressing drizzled.",
    "overhead", ["tricolour quinoa", "roast sweet potato", "kale", "pomegranate"],
    ["chicken", "salmon", "halloumi"]),
  brief("burrata-heirloom-tomato", "burrata-heirloom-tomato.jpg",
    "Whole burrata torn open among sliced heirloom tomatoes, basil and balsamic.",
    "overhead", ["burrata", "heirloom tomatoes", "basil", "aged balsamic"], ["any meat"]),
  brief("hot-smoked-salmon-bowl", "hot-smoked-salmon-bowl.jpg",
    "Rice bowl with flaked hot-smoked salmon, edamame, cucumber and avocado.",
    "overhead", ["hot-smoked salmon", "brown rice", "edamame", "cucumber", "avocado"], []),

  /* Sides */
  brief("skin-on-fries", "skin-on-fries.jpg",
    "Skin-on fries piled in a small metal basket or shallow bowl, rosemary salt visible.",
    "three-quarter", ["skin-on fries", "rosemary salt"], ["cheese", "truffle", "parmesan"]),
  brief("truffle-parmesan-fries", "truffle-parmesan-fries.jpg",
    "Fries under grated parmesan and chopped chives, truffle oil sheen.",
    "three-quarter", ["fries", "grated parmesan", "chives"], []),
  brief("sweet-potato-fries", "sweet-potato-fries.jpg",
    "Sweet potato fries with a ramekin of chipotle mayo beside them.",
    "three-quarter", ["sweet potato fries", "chipotle mayo on the side"], []),
  brief("buttermilk-slaw", "buttermilk-slaw.jpg",
    "Buttermilk slaw in a small bowl, dill visible through the dressing.",
    "overhead", ["white cabbage", "carrot", "dill", "buttermilk dressing"], []),
  brief("crispy-onion-rings", "crispy-onion-rings.jpg",
    "Stack of beer-battered onion rings, paprika salt visible on the batter.",
    "three-quarter", ["beer-battered onion rings", "smoked paprika salt"], []),

  /* Desserts */
  brief("salted-caramel-brownie", "salted-caramel-brownie.jpg",
    "Warm brownie square with salted caramel and flaked sea salt on top.",
    "three-quarter", ["fudgy brownie", "salted caramel", "sea salt"],
    ["ice cream", "any scoop"]),
  brief("new-york-cheesecake", "new-york-cheesecake.jpg",
    "Slice of dense baked cheesecake with berry compote spooned over one edge.",
    "three-quarter", ["baked cheesecake slice", "berry compote"], []),
  brief("vanilla-soft-serve", "vanilla-soft-serve.jpg",
    "Vanilla soft serve swirl in a plain cup.",
    "straight-on", ["vanilla soft serve swirl"],
    ["waffle cone", "hot fudge", "sprinkles", "caramel sauce"]),

  /* Drinks */
  brief("craft-lemonade", "craft-lemonade.jpg",
    "Tall glass of cloudy lemonade over ice with a mint sprig.",
    "straight-on", ["cloudy lemonade", "ice", "mint"], []),
  brief("cold-brew-coffee", "cold-brew-coffee.jpg",
    "Glass of cold brew over ice, no milk poured in.",
    "straight-on", ["cold brew coffee", "ice"], ["milk swirl", "oat milk"]),
  brief("local-craft-beer", "local-craft-beer.jpg",
    "Glass of pale craft beer with a settled head.",
    "straight-on", ["pale beer", "head"], ["branded glassware", "brewery logos"]),
  brief("spring-water", "spring-water.jpg",
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
  credit: {
    source: "WordPress Photo Directory",
    url: "https://wordpress.org/photos/photo/858699139d/",
    photographer: "Manjil Aryal",
    licence: "CC0 1.0",
    attributionRequired: false,
    addedOn: "2026-08-22",
  },
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

/**
 * Every photograph whose licence obliges us to name the photographer.
 *
 * Most of the set is CC0 and needs nothing, but a handful are CC BY-SA, and
 * those have to be credited wherever they are shown — not only on the dish page
 * that happens to render `photoCredit()`. The About page lists these so the
 * obligation is met site-wide, and this function is the single source for that
 * list so a swapped photograph cannot leave a stale credit behind.
 */
export function attributedPhotos(): { slug: string; credit: PhotoCredit }[] {
  return [...PHOTO_BRIEFS, HERO_BRIEF]
    .filter((entry) => entry.credit?.attributionRequired)
    .map((entry) => ({ slug: entry.slug, credit: entry.credit! }));
}

/** Dishes still waiting on a photograph. Drives `npm run photos:check`. */
export function unsourcedSlugs(): string[] {
  return PHOTO_BRIEFS.filter((entry) => entry.credit === null).map((e) => e.slug);
}
