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
 * Delivery coverage. A postal code outside every zone cannot be delivered to,
 * which the address step surfaces before the customer fills anything else in.
 */
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "zone-core",
    name: "Kreuzberg & Mitte",
    postalCodes: ["10969", "10997", "10999", "10117"],
    deliveryFee: 199,
    minimumOrder: 1000,
    estimatedMinutes: 20,
  },
  {
    id: "zone-inner",
    name: "Neukölln, Friedrichshain & Prenzlauer Berg",
    postalCodes: ["12043", "12045", "10245", "10247", "10405", "10437"],
    deliveryFee: 299,
    minimumOrder: 1500,
    estimatedMinutes: 30,
  },
  {
    id: "zone-outer",
    name: "Schöneberg, Wedding & Treptow",
    postalCodes: ["10827", "10829", "13353", "13355", "12435"],
    deliveryFee: 449,
    minimumOrder: 2000,
    estimatedMinutes: 45,
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
