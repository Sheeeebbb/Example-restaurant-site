/**
 * Urban Table — domain model.
 *
 * Two rules govern everything in this file:
 *
 * 1. MONEY IS ALWAYS INTEGER CENTS. Never a float, never a formatted string.
 *    Floats reintroduce the 0.1 + 0.2 problem into people's bills, and cents
 *    are also what payment processors expect on the wire.
 *
 * 2. TYPES DESCRIBE THE RESTAURANT, NOT THE UI. Nothing here knows about React,
 *    routing, or localStorage, so the same definitions can be reused by a real
 *    API layer later without dragging the frontend along with them.
 */

/** A monetary amount in the smallest currency unit (cents). */
export type Cents = number;

/** ISO-8601 timestamp string. Stored as a string so it survives serialization. */
export type IsoDateTime = string;

/* ── Menu ─────────────────────────────────────────────────────────────────── */

export interface Category {
  id: string;
  slug: string;
  name: string;
  /** Short line shown under the category heading on the menu page. */
  description: string;
  sortOrder: number;
}

export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "spicy"
  | "contains-nuts";

/**
 * A single choice within an option group — "Large", "Extra cheese", "No onion".
 *
 * `priceDelta` is signed: it may be 0 (a plain variant), positive (an upsell),
 * or negative (a discount for removing something).
 */
export interface MenuOption {
  id: string;
  name: string;
  priceDelta: Cents;
  available: boolean;
  /** Pre-selected when the customiser first opens. */
  isDefault?: boolean;
}

/**
 * Options and extras are the same shape.
 *
 * A required single-select group is "choose your size". An optional
 * multi-select group is "add extras". Modelling them as one concept with a
 * selection mode means the customiser UI, validation, and pricing each need to
 * be written once rather than twice.
 */
export interface OptionGroup {
  id: string;
  name: string;
  description?: string;
  selection: "single" | "multi";
  /** A required group blocks add-to-cart until it is satisfied. */
  required: boolean;
  minSelections: number;
  /** Always 1 for `single`. */
  maxSelections: number;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: Cents;
  image: { src: string; alt: string };
  tags: DietaryTag[];
  allergens: string[];
  /**
   * Staff can flip this to take something off the menu without deleting it —
   * requirement "mark products unavailable". Unavailable items stay visible
   * but cannot be ordered, which is friendlier than making them vanish.
   */
  available: boolean;
  featured: boolean;
  /** Prep time in minutes. Feeds the earliest-collection calculation. */
  kitchenMinutes: number;
  optionGroups: OptionGroup[];
}

/* ── Cart ─────────────────────────────────────────────────────────────────── */

/**
 * A chosen option, with its name and price copied in at selection time.
 *
 * The snapshot is what lets a cart survive a menu edit: if the kitchen re-prices
 * "Extra cheese" while someone is mid-order, their cart still renders coherently
 * instead of half-updating. Checkout re-validates against live data before money
 * moves, so the snapshot is a display convenience, never the source of truth.
 */
export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: Cents;
}

export interface CartLine {
  /**
   * Content-addressed: derived from the item plus its sorted selections and
   * notes. Adding the same configuration twice therefore lands on the same
   * line and bumps its quantity, while a different configuration gets its own
   * row. See `lib/cart/lines.ts`.
   */
  lineId: string;
  menuItemId: string;
  slug: string;
  name: string;
  imageSrc: string;
  basePrice: Cents;
  selections: SelectedOption[];
  /** basePrice + every selected priceDelta. Excludes quantity. */
  unitPrice: Cents;
  quantity: number;
  notes?: string;
}

/* ── Fulfilment ───────────────────────────────────────────────────────────── */

export type FulfillmentType = "delivery" | "pickup";
export type TimingMode = "asap" | "scheduled";

/**
 * A delivery address.
 *
 * Street and house number are separate fields rather than one free-text line:
 * couriers, address-validation services and delivery APIs all want them apart,
 * and splitting a combined line back out reliably is not possible.
 */
export interface Address {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  /** "Buzzer 3B", "leave with the doorman". */
  deliveryInstructions?: string;
}

/**
 * Delivery rules are data, not code. Adding a neighbourhood is a row here;
 * it never means touching the pricing engine.
 */
export interface DeliveryZone {
  id: string;
  name: string;
  /** Inclusive numeric bounds of the postal codes this zone covers. */
  from: number;
  to: number;
  deliveryFee: Cents;
  /** Orders below this subtotal cannot be delivered to this zone. */
  minimumOrder: Cents;
  /** Travel time on top of kitchen prep time. */
  estimatedMinutes: number;
}

export interface Fulfillment {
  type: FulfillmentType;
  timing: TimingMode;
  /** Set only when `timing` is "scheduled". */
  scheduledFor?: IsoDateTime;
  /** Required when `type` is "delivery", absent for pickup. */
  address?: Address;
}

export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
}

/* ── Promotions ───────────────────────────────────────────────────────────── */

export type PromotionKind = "percentage" | "fixed" | "free-delivery";

export interface Promotion {
  code: string;
  kind: PromotionKind;
  /** Percent (0–100) for "percentage", otherwise Cents. Ignored for free-delivery. */
  value: number;
  description: string;
  minimumSubtotal: Cents;
  /** Restricts a code to one fulfilment type, e.g. a pickup-only discount. */
  appliesTo: FulfillmentType[] | "all";
  active: boolean;
  expiresAt?: IsoDateTime;
}

/** Why a code was rejected, so the UI can explain rather than just refuse. */
export type PromotionRejection =
  | "not-found"
  | "inactive"
  | "expired"
  | "below-minimum"
  | "wrong-fulfillment";

export type PromotionResult =
  | { ok: true; promotion: Promotion }
  | { ok: false; reason: PromotionRejection; message: string };

/* ── Pricing ──────────────────────────────────────────────────────────────── */

export interface OrderTotals {
  subtotal: Cents;
  discount: Cents;
  deliveryFee: Cents;
  tax: Cents;
  total: Cents;
}

/* ── Payments ─────────────────────────────────────────────────────────────── */

export type PaymentStatus = "pending" | "succeeded" | "failed";

export interface PaymentResult {
  /** "mock" today, "stripe" later. */
  provider: string;
  status: PaymentStatus;
  /** Provider-side identifier; a PaymentIntent id once Stripe is wired up. */
  reference: string;
  amount: Cents;
  processedAt: IsoDateTime;
  failureMessage?: string;
}

/**
 * Where a refund has got to.
 *
 * Three of these four come from the payment provider and mean exactly what the
 * provider said. Nothing in this application may set `succeeded` on its own —
 * a refund is money leaving a merchant account, and only the party that moves
 * it can report that it moved.
 *
 *   pending     asked for, not yet confirmed. The honest state between sending
 *               the request and hearing back, and where a refund stays if the
 *               provider takes days to settle it.
 *   succeeded   the provider confirmed it.
 *   failed      the provider refused it, or could not be reached. Staff have to
 *               deal with this by hand; the customer must not be told their
 *               money is on its way.
 *   notRequired our own bookkeeping, not a claim about the provider: this order
 *               never had a successful charge, so there is nothing to send back.
 */
export type RefundStatus = "pending" | "succeeded" | "failed" | "notRequired";

export interface RefundResult {
  /** The provider that was asked. Matches `PaymentResult.provider`. */
  provider: string;
  status: RefundStatus;
  /**
   * Provider-side refund identifier — a Stripe `re_…` once Stripe is wired up.
   *
   * Absent until there is one: a refund that failed before the provider created
   * anything has no id, and inventing one would make the records lie.
   */
  reference?: string;
  /** What was asked for, in cents. Normally the order total. */
  amount: Cents;
  /** When this application sent the request. */
  initiatedAt: IsoDateTime;
  /** When the provider confirmed or refused. Absent while still pending. */
  settledAt?: IsoDateTime;
  /** Why it failed, for staff. Never shown to the customer verbatim. */
  failureMessage?: string;
}

/* ── Orders ───────────────────────────────────────────────────────────────── */

/**
 * The kitchen lifecycle.
 *
 * The allowed moves between these live in `lib/order/transitions.ts`, which is
 * the only place that decides what an order may do next. The short version:
 *
 *   delivery  confirmed → preparing → ready → outForDelivery → completed
 *   pickup    confirmed → preparing → ready → completed
 *
 * Forwards only, one step at a time, with `cancelled` reachable from any
 * unfinished stage and leading nowhere. `outForDelivery` is a delivery stage
 * only — there is nothing to be out for on an order the customer is coming to
 * collect.
 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "outForDelivery"
  | "completed"
  | "cancelled";

export interface OrderStatusEvent {
  status: OrderStatus;
  at: IsoDateTime;
  note?: string;
  /**
   * Where the order was immediately before this event.
   *
   * Recorded only on a correction — a move BACK to an earlier stage. Forward
   * steps do not carry it because the previous entry already says where the
   * order was, and one step forward is the only thing it could have been. A
   * correction is the case where that inference breaks: the trail would
   * otherwise read as though the kitchen had simply started preparing again,
   * with nothing to say an earlier reading had been wrong.
   */
  from?: OrderStatus;
  /**
   * Who moved the order to this status.
   *
   * Once staff have touched an order, the customer-facing tracker stops
   * simulating progress from the clock and reports what the kitchen said —
   * so this is load-bearing, not just an audit field.
   */
  by?: "system" | "staff";
}

export interface Order {
  id: string;
  /** Short human-facing code the customer quotes on the phone, e.g. "UT-4821". */
  reference: string;
  createdAt: IsoDateTime;
  customer: CustomerDetails;
  fulfillment: Fulfillment;
  lines: CartLine[];
  totals: OrderTotals;
  promotionCode?: string;
  status: OrderStatus;
  /** Append-only audit trail; drives the customer-facing tracking timeline. */
  history: OrderStatusEvent[];
  /**
   * Why the restaurant cancelled, in the staff member's own words.
   *
   * Written for the customer, who is shown it verbatim on their tracking page —
   * so the staff form says as much before anyone types into it. Present only on
   * a cancelled order; the history event carries the same text, and this is the
   * copy everything reads so nothing has to walk the audit trail to answer a
   * question the order can answer itself.
   */
  cancellationReason?: string;
  /** When the cancellation was recorded. Present only on a cancelled order. */
  cancelledAt?: IsoDateTime;
  payment: PaymentResult;
  /**
   * The refund raised when the order was cancelled, in whatever state it
   * reached.
   *
   * Written by `transitionOrder` and nowhere else, from what the payment
   * provider actually returned. Absent on any order that has not been
   * cancelled, and on cancellations made before refunds existed — which is why
   * every reader treats "no refund field" as "unknown", never as "none owed".
   */
  refund?: RefundResult;
  estimatedReadyAt: IsoDateTime;
}
