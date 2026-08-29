import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

/**
 * The database schema.
 *
 * ── Conventions carried over from the domain ────────────────────────────────
 * Money is `integer` cents everywhere, never numeric and never a float, because
 * that is the rule `lib/types.ts` is built on and a database column is a poor
 * place to start disagreeing with it.
 *
 * Timestamps are `timestamptz`. The domain passes ISO strings around, so the
 * repositories convert at the boundary; storing them as text would work until
 * the first query that wants to sort or filter by time.
 *
 * ── What is normalised, and what is snapshotted ─────────────────────────────
 * These are different questions and the answer differs per column.
 *
 * NORMALISED means one row, referenced: a role's permissions, a staff member's
 * roles, an order's status events. Editing the thing edits it everywhere,
 * which is right for anything describing how the restaurant works *now*.
 *
 * SNAPSHOTTED means copied at the moment it mattered: what a dish was called
 * and cost when it was ordered, who a customer said they were when they
 * ordered, which roles a staff member held when they touched an order. Re-pricing
 * the Classic Burger must not silently re-price last week's receipts, and a
 * driver promoted next month must not retroactively have been a manager.
 *
 * Both appear below, deliberately, and each is marked.
 */

/**
 * Raw bytes. Drizzle has no first-class `bytea`, and the alternative — base64
 * in a text column — costs a third more storage and an encode/decode on every
 * dish photograph served.
 */
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType: () => "bytea",
});

/* ── Menu ─────────────────────────────────────────────────────────────────── */

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    /* Restricted rather than cascading: deleting a category out from under a
       live menu should fail loudly, not silently take the dishes with it. */
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    basePrice: integer("base_price").notNull(),
    imageSrc: text("image_src").notNull().default(""),
    imageAlt: text("image_alt").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    allergens: text("allergens").array().notNull().default([]),
    available: boolean("available").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    kitchenMinutes: integer("kitchen_minutes").notNull().default(0),
    /**
     * Where the dish sits within its category, as the menu was written.
     *
     * A menu is composed, not alphabetised: the flagship burger leads the
     * burgers, and the water is last among the drinks. Without this the read
     * path falls back to ordering by `id`, which is an internal identifier and
     * produces an order nobody chose — that is exactly what happened when this
     * moved off the seed array, and five of six categories silently reshuffled.
     */
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("menu_items_category_idx").on(table.categoryId),
    index("menu_items_sort_idx").on(table.sortOrder),
  ],
);

/**
 * How a dish may be customised. Normalised, not JSON: these are rows a menu
 * editor will eventually want to sort, rename and re-price individually.
 */
export const optionGroups = pgTable(
  "option_groups",
  {
    id: text("id").primaryKey(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** "single" | "multi" — the domain union, kept as text so adding one is a migration, not a type. */
    selection: text("selection").notNull(),
    required: boolean("required").notNull().default(false),
    minSelections: integer("min_selections").notNull().default(0),
    maxSelections: integer("max_selections").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("option_groups_item_idx").on(table.menuItemId)],
);

export const menuOptions = pgTable(
  "menu_options",
  {
    id: text("id").primaryKey(),
    optionGroupId: text("option_group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Signed: an upsell is positive, "no cheese, 50c off" is negative. */
    priceDelta: integer("price_delta").notNull().default(0),
    available: boolean("available").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("menu_options_group_idx").on(table.optionGroupId)],
);

/** Dish photographs staff uploaded. The shipped ones are files in public/menu/. */
export const menuImages = pgTable("menu_images", {
  id: text("id").primaryKey(),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Customers ────────────────────────────────────────────────────────────── */

/**
 * Who has ordered, deduplicated by email.
 *
 * This is identity — who someone is now. It is NOT what the order shows: the
 * order keeps its own copy of the name and phone given at the time, for the
 * same reason order items keep their own price. Changing your phone number
 * must not rewrite the number the driver was given for a delivery last month.
 *
 * There is no customer login and nothing reads across orders yet, so this
 * exists to avoid a fifth copy of the same person's details after five orders,
 * not to build a profile.
 */
export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    /** Lower-cased on the way in; the natural key. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("customers_email_key").on(table.email)],
);

/* ── Staff, roles, permissions ────────────────────────────────────────────── */

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** Seeded roles cannot be deleted. It does not change what they may do. */
  builtIn: boolean("built_in").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The permission catalogue, as rows.
 *
 * Descriptive, not authoritative: `lib/staff/permissions.ts` is what the
 * application actually checks, and this table is re-synced from it by the seed
 * so an operator can read the catalogue out of the database.
 *
 * Note what is deliberately absent below: `role_permissions.permission` does
 * NOT reference this table. A role written by a newer build may hold a
 * permission this build has never heard of, and the documented rule is that it
 * survives being loaded and saved rather than being silently stripped. A
 * foreign key would enforce exactly the opposite.
 */
export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  groupName: text("group_name").notNull().default(""),
  label: text("label").notNull().default(""),
  description: text("description").notNull().default(""),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    /** Intentionally unconstrained — see the note on `permissions`. */
    permission: text("permission").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    /** A scrypt digest. Never the password, never leaves the server. */
    passwordHash: text("password_hash").notNull(),
    disabled: boolean("disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("staff_username_key").on(table.username)],
);

/**
 * Which roles an account holds. Many-to-many, because a shift manager who
 * drives on Fridays should hold both roles rather than one inflated one.
 *
 * `restrict` on the role: deleting a role that is still assigned must fail, so
 * nobody loses access as a side effect of tidying up.
 */
export const staffRoles = pgTable(
  "staff_roles",
  {
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.staffId, table.roleId] })],
);

/**
 * Live sessions. Server-side, so disabling an account or signing out takes
 * effect immediately and a client holding the cookie cannot outlive either.
 */
export const staffSessions = pgTable(
  "staff_sessions",
  {
    token: text("token").primaryKey(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("staff_sessions_staff_idx").on(table.staffId)],
);

/** Who did what. Actor name is snapshotted so it survives the account being disabled. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    subject: text("subject").notNull(),
    summary: text("summary").notNull(),
  },
  (table) => [index("audit_log_at_idx").on(table.at)],
);

/* ── Orders ───────────────────────────────────────────────────────────────── */

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    /** The short code the customer quotes on the phone. */
    reference: text("reference").notNull(),
    /* Set null rather than cascade: a customer record being removed (a GDPR
       erasure, say) must not take the restaurant's accounting with it. */
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    /* SNAPSHOT — what they told us when they ordered. */
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull(),

    fulfillmentType: text("fulfillment_type").notNull(),
    timingMode: text("timing_mode").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    estimatedReadyAt: timestamp("estimated_ready_at", { withTimezone: true }).notNull(),

    promotionCode: text("promotion_code"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull(),

    /* Cancellation. The reason is shown to the customer verbatim. */
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByStaffId: text("cancelled_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("orders_reference_key").on(table.reference),
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_status_idx").on(table.status),
  ],
);

/** The delivery address, as given for this order. One per order, delivery only. */
export const orderAddresses = pgTable("order_addresses", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  street: text("street").notNull(),
  houseNumber: text("house_number").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  deliveryInstructions: text("delivery_instructions"),
});

/**
 * What was bought — SNAPSHOTTED.
 *
 * The name, image and prices are copied from the menu at the moment of the
 * order and never read back from `menu_items` again. Re-pricing the Classic
 * Burger from 12.50 to 13.50 tomorrow leaves every receipt printed today
 * saying 12.50, which is the only version of this that is not fraud.
 *
 * `menu_item_id` is kept as a nullable, set-null reference: useful for "how
 * many did we sell", and never needed to render the order.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    /** The cart's content-addressed line id, kept so a re-order can match lines. */
    lineId: text("line_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    imageSrc: text("image_src").notNull().default(""),
    basePrice: integer("base_price").notNull(),
    /** basePrice plus every selected delta, excluding quantity. */
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

/** The chosen options, also snapshotted with the name and price paid. */
export const orderItemOptions = pgTable(
  "order_item_options",
  {
    id: text("id").primaryKey(),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    groupId: text("group_id").notNull(),
    groupName: text("group_name").notNull(),
    optionId: text("option_id").notNull(),
    name: text("name").notNull(),
    priceDelta: integer("price_delta").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("order_item_options_item_idx").on(table.orderItemId)],
);

/**
 * Every status change, append-only.
 *
 * `fromStatus` is recorded alongside so each line reads on its own — "Ready →
 * Preparing" — and whether a change was a correction stays derivable rather
 * than being a second field that could disagree with the first.
 *
 * The actor's name and roles are SNAPSHOTTED for the reasons in the file
 * header: people leave, and roles get edited.
 */
export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    fromStatus: text("from_status"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    /*
     * The staff account that made the change — deliberately NOT a foreign key.
     *
     * The name beside it is the record; this is a convenience reference. A
     * constraint here would mean an order write could be rejected because of
     * something about its audit metadata, and an order must never fail to save
     * for a logging reason. It is the same call made on
     * `role_permissions.permission`, for the same kind of reason: the history
     * has to outlive the rows it points at.
     */
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    actorRoles: text("actor_roles").array(),
    /** "system" | "staff" — load-bearing: the customer tracker stops simulating once staff touch it. */
    by: text("by"),
    /** Keeps the trail in order when two events land in the same millisecond. */
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("order_status_events_order_idx").on(table.orderId, table.sortOrder)],
);

/**
 * Who is delivering it.
 *
 * A table with `order_id` as the PRIMARY KEY rather than a column on `orders`,
 * and that is the whole race-condition defence: two drivers pressing Claim at
 * the same instant both run `INSERT … ON CONFLICT DO NOTHING`, and the second
 * one inserts no row and is told so. The guarantee is the constraint, enforced
 * by the database across every process and instance — not a check-then-write in
 * application code, which is only ever safe by luck.
 */
export const deliveryAssignments = pgTable("delivery_assignments", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "restrict" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * What the payment provider said. One per order.
 *
 * Deliberately narrow: the provider's own reference, the amount, the outcome.
 * No card number, no PAN fragment, no cardholder name — none of it is needed to
 * run a restaurant, and storing it would put this database in PCI scope.
 */
export const orderPayments = pgTable("order_payments", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  reference: text("reference").notNull(),
  amount: integer("amount").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull(),
  failureMessage: text("failure_message"),
});

/**
 * What the provider said about giving it back. One per order.
 *
 * `status` is the provider's word, never ours: nothing in the application may
 * write "succeeded" on its own. `settled_at` stays null while a refund is
 * pending, and `reference` stays null when the provider never created one —
 * inventing either would make the record lie about money.
 */
export const orderRefunds = pgTable("order_refunds", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  reference: text("reference"),
  amount: integer("amount").notNull(),
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  failureMessage: text("failure_message"),
});

/**
 * Bookkeeping the staff repository already kept, now with somewhere to live.
 *
 * Drizzle owns the DDL migrations in `drizzle/`; this tracks the separate
 * data-level migrations that seed and re-sync roles, because "add a permission
 * to an existing install without wiping what they changed" is a data question,
 * not a schema one.
 */
export const dataMigrations = pgTable("data_migrations", {
  version: integer("version").primaryKey(),
  name: text("name").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});
