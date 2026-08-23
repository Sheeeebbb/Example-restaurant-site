import type { Cents, DeliveryZone } from "../types";

/**
 * Everything a franchise would change lives here.
 *
 * Opening hours, fees, and zones are configuration rather than constants
 * scattered through components, so this file is the natural thing to move into
 * a `restaurants` database table when the project grows past one location.
 */

/** Minutes past midnight, local time. 11:30 → 690. */
export interface TimeRange {
  opens: number;
  closes: number;
}

const hhmm = (h: number, m = 0) => h * 60 + m;

export const RESTAURANT = {
  name: "Urban Table",
  tagline: "Good food, delivered to your door.",
  description:
    "A modern neighbourhood restaurant serving handmade burgers, sandwiches and salads from quality ingredients. Order for delivery or pickup whenever you're hungry.",

  /**
   * `de-DE` renders euros the way this restaurant's customers read them —
   * "12,50 €". The interface copy is English; number and currency formatting
   * follows the restaurant's locale, not the copy's.
   */
  locale: "de-DE",
  currency: "EUR",

  /**
   * Locale for dates and times the customer READS.
   *
   * `locale` above formats money the way this market writes it ("12,50 €").
   * Weekday and month names are words, though, and formatting them with the
   * same locale drops "Samstag" into otherwise English copy. Times still come
   * out 24-hour, which is right for Berlin either way.
   */
  dateLocale: "en-GB",
  /** IANA zone. All slot generation is anchored to the restaurant, not the customer. */
  timeZone: "Europe/Berlin",

  contact: {
    phone: "+49 30 5550 1420",
    email: "hello@urbantable.example",
  },

  address: {
    line1: "Oranienstraße 148",
    city: "Berlin",
    state: "",
    postalCode: "10969",
  },

  social: [
    { label: "Instagram", href: "https://instagram.com/urbantable" },
    { label: "Facebook", href: "https://facebook.com/urbantable" },
    { label: "TikTok", href: "https://tiktok.com/@urbantable" },
  ],

  /**
   * Index 0 is Sunday, matching `Date.prototype.getDay()`.
   * `null` means closed that day.
   */
  openingHours: [
    { opens: hhmm(12), closes: hhmm(21) }, // Sun
    null, // Mon — closed
    { opens: hhmm(11, 30), closes: hhmm(22) }, // Tue
    { opens: hhmm(11, 30), closes: hhmm(22) }, // Wed
    { opens: hhmm(11, 30), closes: hhmm(22) }, // Thu
    { opens: hhmm(11, 30), closes: hhmm(23) }, // Fri
    { opens: hhmm(12), closes: hhmm(23) }, // Sat
  ] as (TimeRange | null)[],

  ordering: {
    /** Kitchen turnaround floor, before per-item prep time is considered. */
    minimumPrepMinutes: 20,
    /** Granularity of the scheduled-time picker. */
    slotIntervalMinutes: 15,
    /** How far ahead a customer may schedule. */
    maxDaysAhead: 6,
    /** No new orders in the last stretch before close. */
    lastOrderBufferMinutes: 30,
    /** Cap per line, to stop a typo becoming 400 burgers. */
    maxQuantityPerLine: 20,
    /** Cap on a line's special instructions. Enforced server-side, not just in the textarea. */
    maxNoteLength: 200,
    /** Cap on separate lines in one order. */
    maxLinesPerOrder: 40,
  },

  fees: {
    /**
     * German restaurant VAT on prepared food. Menu prices in this market are
     * quoted inclusive of VAT, so this rate is here for the receipt breakdown
     * rather than to be added on top — see `lib/cart/totals.ts`.
     */
    taxRatePercent: 19,

    /**
     * The standard delivery fee — the single number to change when delivery
     * pricing changes.
     *
     * It applies to every delivery order unless the customer's postal code
     * matches a `DELIVERY_ZONES` entry, which may override it. Having a flat
     * default matters for the cart: without one, the fee would read as free
     * until an address was entered, which is a promise we would then have to
     * take back at checkout.
     */
    deliveryFee: 299 as Cents,

    /** Delivery is free at or above this subtotal, before discounts. */
    freeDeliveryThreshold: 2500 as Cents,
  },
} as const;

/**
 * How far the vans go.
 *
 * These four numbers are the delivery boundary for the whole application. Every
 * check — the cart, the address form, the server that accepts the order — reads
 * them through `lib/fulfillment/postal-code.ts` rather than repeating a range
 * of its own, so widening the area is an edit here and nowhere else.
 *
 * `digits` is the postal-code length in this market. It is what makes "893" an
 * unfinished code rather than a rejected one, and what stops a longer code
 * being quietly truncated into a deliverable one.
 */
export const DELIVERY_AREA = {
  minPostalCode: 8930,
  maxPostalCode: 8940,
  digits: 4,
} as const;

/**
 * Delivery coverage. A postal code outside every zone cannot be delivered to,
 * which the address step surfaces before the customer fills anything else in.
 *
 * Zones carry the fee, the minimum order and the travel time, so several of
 * them can price a city in rings. Today there is one, covering the whole
 * delivery area — the range above IS the zone — but the shape is unchanged, so
 * splitting it back into rings later means adding rows here and nothing else.
 */
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "zone-local",
    name: `${DELIVERY_AREA.minPostalCode} – ${DELIVERY_AREA.maxPostalCode}`,
    from: DELIVERY_AREA.minPostalCode,
    to: DELIVERY_AREA.maxPostalCode,
    deliveryFee: 299,
    /** Matches the smallest minimum the old ring of zones used, so no existing
        basket that could be delivered before now falls under it. */
    minimumOrder: 1000,
    estimatedMinutes: 30,
  },
];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
