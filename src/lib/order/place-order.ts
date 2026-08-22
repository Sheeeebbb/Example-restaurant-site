import type {
  CartLine,
  Fulfillment,
  Order,
  OrderStatus,
  SelectedOption,
} from "../types";
import { getMenuItemsByIds, getPromotion } from "../data/repository";
import { calculateTotals } from "../cart/totals";
import { createCartLine, findUnsatisfiedGroups } from "../cart/lines";
import { findZone } from "../fulfillment/delivery";
import { resolveReadyTime } from "../fulfillment/scheduling";
import { validatePromotion } from "../data/promotions";
import { validateOrderDraft, validateTiming, toAddress, toCustomerDetails } from "./validation";
import type { OrderDraft } from "./validation";
import { generateOrderReference } from "./reference";
import { getPaymentProvider } from "../payments";
import { RESTAURANT } from "../config/restaurant";

/**
 * Turning a basket into an order — the authoritative version.
 *
 * This runs on the server (see `app/api/checkout/route.ts`) and treats the
 * request as untrusted input. In particular it NEVER accepts a price:
 *
 *   • The client sends item ids, option ids, quantities and notes.
 *   • This module looks each item up in the menu, rebuilds the selections from
 *     the live option data, and recomputes every unit price itself.
 *   • Totals, the discount, and the delivery fee are recalculated here.
 *   • The payment provider is charged THAT figure.
 *
 * A client that sends `total: 1` gets charged the real amount, because the
 * number it sent is never read. This is the same `calculateTotals` the cart
 * uses for its preview, so the two agree — but only this one decides.
 *
 * No card details are accepted, because none are sent. See `MockPaymentForm`.
 */

/** What the client is allowed to send. Note the absence of any price field. */
export interface PlaceOrderRequest {
  lines: {
    menuItemId: string;
    optionIds: string[];
    quantity: number;
    notes?: string;
  }[];
  fulfillment: {
    type: "delivery" | "pickup";
    timing: "asap" | "scheduled";
    scheduledFor?: string;
  };
  draft: OrderDraft;
  promotionCode?: string;
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; field?: string };

const MAX_LINES = 40;

export async function placeOrder(
  request: PlaceOrderRequest,
  now: Date = new Date(),
): Promise<PlaceOrderResult> {
  /* ── 1. Validate the cart ───────────────────────────────────────────────── */
  if (!Array.isArray(request.lines) || request.lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (request.lines.length > MAX_LINES) {
    return { ok: false, error: "That's too many separate items for one order." };
  }

  const items = await getMenuItemsByIds(
    request.lines.map((line) => line.menuItemId),
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const lines: CartLine[] = [];
  for (const requested of request.lines) {
    const item = itemsById.get(requested.menuItemId);
    if (!item) {
      return { ok: false, error: "One of these items is no longer on the menu." };
    }
    if (!item.available) {
      return { ok: false, error: `${item.name} has just sold out.` };
    }

    const quantity = Math.floor(requested.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false, error: `Invalid quantity for ${item.name}.` };
    }
    if (quantity > RESTAURANT.ordering.maxQuantityPerLine) {
      return {
        ok: false,
        error: `You can order at most ${RESTAURANT.ordering.maxQuantityPerLine} of ${item.name}.`,
      };
    }

    // Rebuild the selections from live menu data. Prices come from here, never
    // from the request — this is the step that makes tampering pointless.
    const chosen = new Set(requested.optionIds ?? []);
    const selections: SelectedOption[] = [];
    for (const group of item.optionGroups) {
      for (const option of group.options) {
        if (!chosen.has(option.id)) continue;
        if (!option.available) {
          return { ok: false, error: `${option.name} is no longer available.` };
        }
        selections.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
        });
      }
    }

    const unsatisfied = findUnsatisfiedGroups(item, selections);
    if (unsatisfied.length > 0) {
      const group = item.optionGroups.find((g) => g.id === unsatisfied[0]);
      return {
        ok: false,
        error: `${item.name} needs a choice for "${group?.name ?? "an option"}".`,
      };
    }

    lines.push(createCartLine(item, selections, quantity, requested.notes));
  }

  /* ── 2. Validate the customer's details ─────────────────────────────────── */
  const fulfillmentType = request.fulfillment?.type;
  if (fulfillmentType !== "delivery" && fulfillmentType !== "pickup") {
    return { ok: false, error: "Choose delivery or pickup." };
  }

  const fieldErrors = validateOrderDraft(request.draft, fulfillmentType);
  const firstError = Object.entries(fieldErrors)[0];
  if (firstError) {
    return { ok: false, error: firstError[1], field: firstError[0] };
  }

  const zone =
    fulfillmentType === "delivery" ? findZone(request.draft.postalCode) : null;

  const timing = request.fulfillment.timing === "scheduled" ? "scheduled" : "asap";
  const timingError = validateTiming(
    timing,
    request.fulfillment.scheduledFor,
    fulfillmentType,
    zone,
    now,
  );
  if (timingError) return { ok: false, error: timingError, field: "scheduledFor" };

  /* ── 3. Recompute the money ─────────────────────────────────────────────── */
  const subtotal = lines.reduce(
    (total, line) => total + line.unitPrice * line.quantity,
    0,
  );

  let promotion = null;
  if (request.promotionCode) {
    const known = await getPromotion(request.promotionCode);
    if (known) {
      const result = validatePromotion(
        known.code,
        subtotal,
        fulfillmentType,
        now,
      );
      // A code that no longer qualifies is dropped silently rather than failing
      // the order — the customer is charged the correct, undiscounted amount.
      if (result.ok) promotion = result.promotion;
    }
  }

  const totals = calculateTotals({ lines, fulfillmentType, zone, promotion });
  if (totals.total <= 0) {
    return { ok: false, error: "This order totals nothing. Please add an item." };
  }

  const shortfall = zone ? zone.minimumOrder - subtotal : 0;
  if (fulfillmentType === "delivery" && shortfall > 0) {
    return { ok: false, error: "This order is below the minimum for delivery." };
  }

  /* ── 4. Take payment ────────────────────────────────────────────────────── */
  const reference = generateOrderReference();
  const customer = toCustomerDetails(request.draft);

  const payment = await getPaymentProvider().createPayment({
    amount: totals.total,
    currency: RESTAURANT.currency,
    orderReference: reference,
    customer,
  });

  if (payment.status !== "succeeded") {
    return {
      ok: false,
      error: payment.failureMessage ?? "The payment could not be completed.",
    };
  }

  /* ── 5. Build the order ─────────────────────────────────────────────────── */
  const slowestItem = Math.max(
    ...lines.map((line) => {
      const item = itemsById.get(line.menuItemId);
      return item?.kitchenMinutes ?? 0;
    }),
  );

  const readyAt = resolveReadyTime(
    now,
    timing,
    request.fulfillment.scheduledFor,
    fulfillmentType,
    zone,
    slowestItem,
  );

  const fulfillment: Fulfillment = {
    type: fulfillmentType,
    timing,
    scheduledFor: timing === "scheduled" ? request.fulfillment.scheduledFor : undefined,
    address: fulfillmentType === "delivery" ? toAddress(request.draft) : undefined,
  };

  const status: OrderStatus = "confirmed";
  const createdAt = now.toISOString();

  const order: Order = {
    id: `ord_${now.getTime()}_${reference.slice(3)}`,
    reference,
    createdAt,
    customer,
    fulfillment,
    lines,
    totals,
    promotionCode: promotion?.code,
    status,
    history: [{ status, at: createdAt, note: "Payment accepted." }],
    payment,
    estimatedReadyAt: readyAt.toISOString(),
  };

  return { ok: true, order };
}
