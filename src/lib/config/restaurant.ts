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
  tagline: "Wood-fired plates, natural wine, no fuss.",
  description:
    "A neighbourhood kitchen in the Old Fourth Ward serving wood-fired plates, handmade pasta and natural wine. Order ahead for pickup or delivery.",

  locale: "en-US",
  currency: "USD",
  /** IANA zone. All slot generation is anchored to the restaurant, not the customer. */
  timeZone: "America/New_York",

  contact: {
    phone: "(404) 555-0142",
    email: "hello@urbantable.example",
  },

  address: {
    line1: "218 Edgewood Avenue",
    city: "Atlanta",
    state: "GA",
    postalCode: "30303",
  },

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
  },

  fees: {
    /** Applied on the discounted subtotal. Real deployments vary this by jurisdiction. */
    taxRatePercent: 8.9,
    /** Delivery is free at or above this subtotal, before discounts. */
    freeDeliveryThreshold: 4500 as Cents,
  },
} as const;

/**
 * Delivery coverage. A postal code outside every zone cannot be delivered to,
 * which the address step surfaces before the customer fills anything else in.
 */
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "zone-core",
    name: "Downtown & Old Fourth Ward",
    postalCodes: ["30303", "30308", "30312"],
    deliveryFee: 299,
    minimumOrder: 1500,
    estimatedMinutes: 20,
  },
  {
    id: "zone-inner",
    name: "Inman Park, Midtown & Grant Park",
    postalCodes: ["30306", "30307", "30309", "30315"],
    deliveryFee: 499,
    minimumOrder: 2500,
    estimatedMinutes: 30,
  },
  {
    id: "zone-outer",
    name: "Decatur & West End",
    postalCodes: ["30030", "30310", "30316", "30317"],
    deliveryFee: 699,
    minimumOrder: 3500,
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
