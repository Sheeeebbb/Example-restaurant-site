import { randomUUID } from "node:crypto";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "./client";
import * as t from "./schema";
import type {
  Order,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  RefundStatus,
  SelectedOption,
} from "../types";

/**
 * Writing an order down, and reading it back.
 *
 * An order is one row plus six tables of detail, and the whole graph is written
 * in one transaction — an order with no items, or items with no payment, is not
 * a state anything should be able to observe.
 */

const iso = (date: Date) => date.toISOString();
const at = (value: string | undefined | null): Date | null =>
  value ? new Date(value) : null;

/* ── Writing ──────────────────────────────────────────────────────────────── */

/**
 * Finds or creates the customer this order belongs to.
 *
 * Identity only. The order carries its own copy of the name and phone, so this
 * updating does not rewrite what any previous order shows — see the note on the
 * `customers` table.
 */
async function upsertCustomer(tx: Tx, order: Order): Promise<string> {
  const email = order.customer.email.trim().toLowerCase();
  const now = new Date();

  const rows = await tx
    .insert(t.customers)
    .values({
      id: `cus_${randomUUID()}`,
      email,
      name: order.customer.name,
      phone: order.customer.phone,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: t.customers.email,
      set: { name: order.customer.name, phone: order.customer.phone, updatedAt: now },
    })
    .returning({ id: t.customers.id });

  return rows[0].id;
}

/**
 * Writes an order and everything hanging off it.
 *
 * The detail tables are replaced rather than diffed. They are small, they are
 * only ever written as a set, and a delete-then-insert inside a transaction is
 * both simpler to read and impossible to leave half-applied.
 */
export async function writeOrder(tx: Tx, order: Order): Promise<void> {
  const customerId = await upsertCustomer(tx, order);

  const row = {
    id: order.id,
    reference: order.reference,
    customerId,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerPhone: order.customer.phone,
    createdAt: new Date(order.createdAt),
    status: order.status,
    fulfillmentType: order.fulfillment.type,
    timingMode: order.fulfillment.timing,
    scheduledFor: at(order.fulfillment.scheduledFor),
    estimatedReadyAt: new Date(order.estimatedReadyAt),
    promotionCode: order.promotionCode ?? null,
    subtotal: order.totals.subtotal,
    discount: order.totals.discount,
    deliveryFee: order.totals.deliveryFee,
    tax: order.totals.tax,
    total: order.totals.total,
    cancellationReason: order.cancellationReason ?? null,
    cancelledAt: at(order.cancelledAt),
  };

  await tx.insert(t.orders).values(row).onConflictDoUpdate({
    target: t.orders.id,
    set: row,
  });

  /* Address — delivery only. Removed if the order became a pickup. */
  await tx.delete(t.orderAddresses).where(eq(t.orderAddresses.orderId, order.id));
  const address = order.fulfillment.address;
  if (address) {
    await tx.insert(t.orderAddresses).values({
      orderId: order.id,
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      city: address.city,
      deliveryInstructions: address.deliveryInstructions ?? null,
    });
  }

  /* Items and their chosen options — the snapshot of what was bought. */
  await tx.delete(t.orderItems).where(eq(t.orderItems.orderId, order.id));
  for (const [index, line] of order.lines.entries()) {
    const itemId = `oit_${order.id}_${index}`;
    await tx.insert(t.orderItems).values({
      id: itemId,
      orderId: order.id,
      /*
       * Nullable and set-null on delete. The order renders entirely from the
       * columns beside it; this is only here so "how many Classic Burgers did
       * we sell" can be asked, and a dish taken off the menu must not take the
       * receipts with it.
       */
      menuItemId: line.menuItemId,
      lineId: line.lineId,
      slug: line.slug,
      name: line.name,
      imageSrc: line.imageSrc,
      basePrice: line.basePrice,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      notes: line.notes ?? null,
      sortOrder: index,
    });

    for (const [optionIndex, option] of line.selections.entries()) {
      await tx.insert(t.orderItemOptions).values({
        id: `oio_${itemId}_${optionIndex}`,
        orderItemId: itemId,
        groupId: option.groupId,
        groupName: option.groupName,
        optionId: option.optionId,
        name: option.name,
        priceDelta: option.priceDelta,
        sortOrder: optionIndex,
      });
    }
  }

  /* Status history. Append-only in meaning; rewritten as a set for simplicity. */
  await tx.delete(t.orderStatusEvents).where(eq(t.orderStatusEvents.orderId, order.id));
  for (const [index, event] of order.history.entries()) {
    await tx.insert(t.orderStatusEvents).values({
      id: `evt_${order.id}_${index}`,
      orderId: order.id,
      status: event.status,
      fromStatus: event.from ?? null,
      at: new Date(event.at),
      note: event.note ?? null,
      /*
       * The actor id carries no foreign key — see the schema. An event recorded
       * by an account since deleted keeps its snapshotted name, and no order
       * write can be rejected because of who is recorded as having touched it.
       */
      actorId: event.actorId ?? null,
      actorName: event.actorName ?? null,
      actorRoles: event.actorRoles ?? null,
      by: event.by ?? null,
      sortOrder: index,
    });
  }

  /* Payment. Exactly what the provider said, and nothing about the card. */
  const payment = {
    orderId: order.id,
    provider: order.payment.provider,
    status: order.payment.status,
    reference: order.payment.reference,
    amount: order.payment.amount,
    processedAt: new Date(order.payment.processedAt),
    failureMessage: order.payment.failureMessage ?? null,
  };
  await tx
    .insert(t.orderPayments)
    .values(payment)
    .onConflictDoUpdate({ target: t.orderPayments.orderId, set: payment });

  /* Refund. Absent until a cancellation raises one. */
  if (order.refund) {
    const refund = {
      orderId: order.id,
      provider: order.refund.provider,
      status: order.refund.status,
      reference: order.refund.reference ?? null,
      amount: order.refund.amount,
      initiatedAt: new Date(order.refund.initiatedAt),
      settledAt: at(order.refund.settledAt),
      failureMessage: order.refund.failureMessage ?? null,
    };
    await tx
      .insert(t.orderRefunds)
      .values(refund)
      .onConflictDoUpdate({ target: t.orderRefunds.orderId, set: refund });
  }

  /*
   * Delivery assignment.
   *
   * Written here only to keep an in-memory `Order` round-tripping. The claim
   * path does NOT come through here — it inserts directly, so the primary key
   * is what decides the race. See `claimDelivery`.
   */
  if (order.assignedStaffId) {
    await tx
      .insert(t.deliveryAssignments)
      .values({
        orderId: order.id,
        staffId: order.assignedStaffId,
        assignedAt: order.assignedAt ? new Date(order.assignedAt) : new Date(),
      })
      .onConflictDoNothing();
  } else {
    await tx.delete(t.deliveryAssignments).where(eq(t.deliveryAssignments.orderId, order.id));
  }
}

/* ── Reading ──────────────────────────────────────────────────────────────── */

type OrderRow = typeof t.orders.$inferSelect;

/**
 * Assembles orders from their seven tables.
 *
 * Six queries for any number of orders, not six per order: the detail rows are
 * fetched for the whole set with `IN (…)` and stitched in memory. The kitchen
 * board lists every open order at once, and a per-order query there would be
 * the classic N+1.
 */
export async function hydrateOrders(db: Db | Tx, rows: OrderRow[]): Promise<Order[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  /*
   * Sequential, NOT `Promise.all` — and this cost a real bug to learn.
   *
   * `db` here may be a transaction, and a transaction is a single connection.
   * Issuing six queries at once on one connection interleaves them on the wire:
   * node-postgres warns ("client.query() when the client is already executing a
   * query"), results come back against the wrong statements, and the
   * transaction can abort. The symptom was a delivery claim that returned 200
   * with a fully-populated order and had, on inspection, written nothing —
   * because the INSERT was rolled back by the read that followed it.
   *
   * Six round trips instead of one batch is a few milliseconds. Being wrong
   * under concurrency is a delivery nobody is assigned to.
   */
  const items = await db.select().from(t.orderItems).where(inArray(t.orderItems.orderId, ids)).orderBy(asc(t.orderItems.sortOrder));
  const events = await db.select().from(t.orderStatusEvents).where(inArray(t.orderStatusEvents.orderId, ids)).orderBy(asc(t.orderStatusEvents.sortOrder));
  const addresses = await db.select().from(t.orderAddresses).where(inArray(t.orderAddresses.orderId, ids));
  const payments = await db.select().from(t.orderPayments).where(inArray(t.orderPayments.orderId, ids));
  const refunds = await db.select().from(t.orderRefunds).where(inArray(t.orderRefunds.orderId, ids));
  const assignments = await db.select().from(t.deliveryAssignments).where(inArray(t.deliveryAssignments.orderId, ids));

  const options =
    items.length > 0
      ? await db
          .select()
          .from(t.orderItemOptions)
          .where(
            inArray(
              t.orderItemOptions.orderItemId,
              items.map((item) => item.id),
            ),
          )
          .orderBy(asc(t.orderItemOptions.sortOrder))
      : [];

  const optionsByItem = new Map<string, SelectedOption[]>();
  for (const option of options) {
    const entry: SelectedOption = {
      groupId: option.groupId,
      groupName: option.groupName,
      optionId: option.optionId,
      name: option.name,
      priceDelta: option.priceDelta,
    };
    const bucket = optionsByItem.get(option.orderItemId);
    if (bucket) bucket.push(entry);
    else optionsByItem.set(option.orderItemId, [entry]);
  }

  const group = <T extends { orderId: string }>(list: T[]) => {
    const byOrder = new Map<string, T[]>();
    for (const row of list) {
      const bucket = byOrder.get(row.orderId);
      if (bucket) bucket.push(row);
      else byOrder.set(row.orderId, [row]);
    }
    return byOrder;
  };

  const itemsByOrder = group(items);
  const eventsByOrder = group(events);
  const addressByOrder = new Map(addresses.map((row) => [row.orderId, row]));
  const paymentByOrder = new Map(payments.map((row) => [row.orderId, row]));
  const refundByOrder = new Map(refunds.map((row) => [row.orderId, row]));
  const assignmentByOrder = new Map(assignments.map((row) => [row.orderId, row]));

  return rows.map((row) => {
    const address = addressByOrder.get(row.id);
    const payment = paymentByOrder.get(row.id);
    const refund = refundByOrder.get(row.id);
    const assignment = assignmentByOrder.get(row.id);

    const history: OrderStatusEvent[] = (eventsByOrder.get(row.id) ?? []).map((event) => ({
      status: event.status as OrderStatus,
      at: iso(event.at),
      ...(event.note ? { note: event.note } : {}),
      ...(event.fromStatus ? { from: event.fromStatus as OrderStatus } : {}),
      ...(event.actorId ? { actorId: event.actorId } : {}),
      ...(event.actorName ? { actorName: event.actorName } : {}),
      ...(event.actorRoles?.length ? { actorRoles: event.actorRoles } : {}),
      ...(event.by ? { by: event.by as "system" | "staff" } : {}),
    }));

    return {
      id: row.id,
      reference: row.reference,
      createdAt: iso(row.createdAt),
      customer: {
        name: row.customerName,
        email: row.customerEmail,
        phone: row.customerPhone,
      },
      fulfillment: {
        type: row.fulfillmentType as Order["fulfillment"]["type"],
        timing: row.timingMode as Order["fulfillment"]["timing"],
        ...(row.scheduledFor ? { scheduledFor: iso(row.scheduledFor) } : {}),
        ...(address
          ? {
              address: {
                street: address.street,
                houseNumber: address.houseNumber,
                postalCode: address.postalCode,
                city: address.city,
                ...(address.deliveryInstructions
                  ? { deliveryInstructions: address.deliveryInstructions }
                  : {}),
              },
            }
          : {}),
      },
      lines: (itemsByOrder.get(row.id) ?? []).map((item) => ({
        lineId: item.lineId,
        menuItemId: item.menuItemId ?? "",
        slug: item.slug,
        name: item.name,
        imageSrc: item.imageSrc,
        basePrice: item.basePrice,
        selections: optionsByItem.get(item.id) ?? [],
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
      })),
      totals: {
        subtotal: row.subtotal,
        discount: row.discount,
        deliveryFee: row.deliveryFee,
        tax: row.tax,
        total: row.total,
      },
      ...(row.promotionCode ? { promotionCode: row.promotionCode } : {}),
      status: row.status as OrderStatus,
      history,
      ...(row.cancellationReason ? { cancellationReason: row.cancellationReason } : {}),
      ...(row.cancelledAt ? { cancelledAt: iso(row.cancelledAt) } : {}),
      ...(assignment
        ? { assignedStaffId: assignment.staffId, assignedAt: iso(assignment.assignedAt) }
        : {}),
      /*
       * A payment row is written with every order, so its absence means the
       * write was interrupted. A zero-amount placeholder would be a lie about
       * money; this is loud instead.
       */
      payment: payment
        ? {
            provider: payment.provider,
            status: payment.status as PaymentStatus,
            reference: payment.reference,
            amount: payment.amount,
            processedAt: iso(payment.processedAt),
            ...(payment.failureMessage ? { failureMessage: payment.failureMessage } : {}),
          }
        : (() => {
            throw new Error(`Order ${row.reference} has no payment row.`);
          })(),
      ...(refund
        ? {
            refund: {
              provider: refund.provider,
              status: refund.status as RefundStatus,
              ...(refund.reference ? { reference: refund.reference } : {}),
              amount: refund.amount,
              initiatedAt: iso(refund.initiatedAt),
              ...(refund.settledAt ? { settledAt: iso(refund.settledAt) } : {}),
              ...(refund.failureMessage ? { failureMessage: refund.failureMessage } : {}),
            },
          }
        : {}),
      estimatedReadyAt: iso(row.estimatedReadyAt),
    } satisfies Order;
  });
}

export async function loadOrderByReference(
  db: Db | Tx,
  reference: string,
): Promise<Order | null> {
  const rows = await db.select().from(t.orders).where(eq(t.orders.reference, reference));
  return (await hydrateOrders(db, rows))[0] ?? null;
}

/** Newest first, which is the order every staff screen wants them in. */
export async function loadOrders(db: Db | Tx): Promise<Order[]> {
  const rows = await db.select().from(t.orders).orderBy(desc(t.orders.createdAt));
  return hydrateOrders(db, rows);
}
