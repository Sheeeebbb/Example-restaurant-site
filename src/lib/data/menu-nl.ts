/**
 * The menu, in Dutch.
 *
 * Keyed by the dish's own id, so this is a translation of an existing record
 * rather than a second menu. A dish missing from here shows its English name —
 * see `menu-queries.ts`. Nothing in this file can change a price, an
 * availability flag, or what any past order contained.
 *
 * Seeded into `menu_item_translations` by `db/seed.ts`. Once a menu editor
 * exists, staff edit the rows and this becomes the factory default, exactly as
 * `menu.ts` already is for the English copy.
 */

export interface ContentTranslation {
  name?: string;
  description?: string;
}

export const CATEGORY_NL: Record<string, ContentTranslation> = {
  "cat-burgers": {
    name: "Burgers",
    description: "Op de plaat gebakken, in een geroosterd aardappelbroodje.",
  },
  "cat-sandwiches": {
    name: "Broodjes",
    description: "Royaal belegd, op brood dat we elke ochtend zelf bakken.",
  },
  "cat-salads": {
    name: "Salades",
    description: "Groot, goed aangemaakt en nooit een bijgedachte.",
  },
  "cat-sides": { name: "Bijgerechten", description: "De onmisbare bijrol." },
  "cat-desserts": { name: "Nagerechten", description: "Het bewaren waard." },
  "cat-drinks": { name: "Dranken", description: "Vers geperst, cold brew en bier van de tap." },
};

export const MENU_ITEM_NL: Record<string, ContentTranslation> = {
  /* Burgers */
  "itm-classic": {
    name: "Urban Classic Burger",
    description:
      "Gerijpt rundvlees, gesmolten cheddar, huisgemaakte augurk, geheime saus, geroosterd aardappelbroodje.",
  },
  "itm-bbq-bacon": {
    name: "Smoky BBQ Bacon",
    description:
      "Dubbelgerookt spek, krokante ui, gerijpte cheddar en onze eigen bourbon-barbecuesaus.",
  },
  "itm-double-smash": {
    name: "Double Smash Deluxe",
    description:
      "Twee dungeslagen burgers, dubbele cheddar, gegrilde ui, augurk en deluxesaus.",
  },
  "itm-crispy-chicken": {
    name: "Krokante Kipburger",
    description: "In karnemelk gemarineerde kippendij, coleslaw, srirachamayo, geroosterd broodje.",
  },
  "itm-truffle-mushroom": {
    name: "Truffel Champignon Swiss",
    description: "Gebakken knoflookchampignons, Zwitserse kaas, truffelaioli, rucola.",
  },
  "itm-garden": {
    name: "Garden Burger",
    description: "Burger van biet en zwarte bonen, geprakte avocado, vegan chipotlemayo.",
  },

  /* Broodjes */
  "itm-beef-dip": {
    name: "Gestoofd Rundvlees Broodje",
    description: "Zes uur gestoofde runderschouder, gekarameliseerde ui, Gruyère, rijke jus.",
  },
  "itm-chicken-club": {
    name: "Gegrilde Kipclub",
    description: "Gegrilde kip, gerookt spek, avocado, kruidenmayo, tomaat.",
  },
  "itm-halloumi": {
    name: "Halloumi & Geroosterde Paprika",
    description: "Gegrilde halloumi, zoete paprika, rucola, basilicumpesto.",
  },
  "itm-chicken-wrap": {
    name: "Karnemelk Kipwrap",
    description: "Krokante kip, little gem, gepekelde chilipeper, ranchdressing.",
  },

  /* Salades */
  "itm-caesar": {
    name: "Caesarsalade met Kip",
    description: "Gegrilde kip, little gem, geschaafde Parmezaan, zuurdesemcroutons.",
  },
  "itm-quinoa": {
    name: "Superfood Quinoabowl",
    description: "Driekleurige quinoa, geroosterde zoete aardappel, boerenkool, granaatappel.",
  },
  "itm-burrata-salad": {
    name: "Burrata & Heirloom Tomaat",
    description: "Romige burrata, heirloomtomaten, basilicum, oude balsamico, olijfolie.",
  },

  /* Bijgerechten */
  "itm-fries": { name: "Frietjes met Schil", description: "Dubbel gefrituurd, rozemarijnzout." },
  "itm-truffle-fries": {
    name: "Truffel-Parmezaanfriet",
    description: "Truffelolie, oude Parmezaan, bieslook.",
  },
  "itm-sweet-potato": {
    name: "Zoete Aardappelfriet",
    description: "Knapperig gebakken, met chipotlemayo.",
  },
  "itm-slaw": { name: "Karnemelk Coleslaw", description: "Wittekool, wortel, karnemelkdressing." },
  "itm-onion-rings": { name: "Krokante Uienringen", description: "In bierbeslag, grof zeezout." },

  /* Nagerechten */
  "itm-brownie": {
    name: "Brownie met Gezouten Karamel",
    description: "Smeuïge chocoladebrownie, gezouten karamel.",
  },
  "itm-cheesecake": {
    name: "New York Cheesecake",
    description: "Stevig gebakken, met compote van rood fruit.",
  },
  "itm-soft-serve": { name: "Vanille-softijs", description: "Zacht draaiend, met bourbonvanille." },

  /* Dranken */
  "itm-lemonade": { name: "Ambachtelijke Limonade", description: "Vers geperst, licht gezoet." },
  "itm-cold-brew": { name: "Cold Brew Koffie", description: "Achttien uur koud getrokken." },
  "itm-craft-beer": { name: "Lokaal Speciaalbier", description: "Wisselende tap van de buurtbrouwerij." },
  "itm-water": { name: "Bronwater", description: "Plat of met bubbels." },
};
