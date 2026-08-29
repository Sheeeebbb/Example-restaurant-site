
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb, type Db, type Tx } from "./client";
import * as t from "./schema";
import { CATEGORIES, MENU_ITEMS } from "../data/menu";
import { PERMISSION_CATALOGUE, ALL_PERMISSIONS } from "../staff/permissions";
import { hashPassword } from "../staff/password";

/**
 * Seeding and data migrations.
 *
 * Two different jobs, deliberately kept apart:
 *
 * REFERENCE DATA (`syncCatalogue`) is the menu and the permission catalogue —
 * things defined in code that the database mirrors. Re-synced on every run and
 * safe to repeat: it upserts, so a dish staff renamed keeps its name unless the
 * code changed it too, and a dish staff added by hand is left alone.
 *
 * DATA MIGRATIONS (`MIGRATIONS`) are the once-only steps that create roles and
 * the first account. Versioned in `data_migrations`, exactly as the in-memory
 * store modelled with its `dataVersion` counter, because the shape of the
 * problem never changed — only where the answer is written down. Step 1 must
 * not re-run against an install that has since renamed a role, and a step added
 * later must run against installs that already exist.
 *
 * Migrations are additive by construction: they create what is missing and
 * leave what is there. None deletes or overwrites staff-created data.
 */

/* ── Reference data ───────────────────────────────────────────────────────── */

/**
 * Pushes the code-defined catalogue into the database.
 *
 * Upserts rather than truncating, which is the whole difference between "the
 * menu is under version control" and "deploying wipes what the kitchen did
 * this morning". A dish removed from the code is NOT deleted here — taking
 * something off the menu is `available: false` through the admin screens, and a
 * deploy silently deleting rows that orders reference is not a thing this
 * should be able to do.
 */
export async function syncCatalogue(db: Db | Tx = getDb()): Promise<void> {
  for (const category of CATEGORIES) {
    await db
      .insert(t.categories)
      .values(category)
      .onConflictDoUpdate({
        target: t.categories.id,
        set: {
          slug: category.slug,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      });
  }

  for (const [index, item] of MENU_ITEMS.entries()) {
    await db
      .insert(t.menuItems)
      .values({
        id: item.id,
        slug: item.slug,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        basePrice: item.basePrice,
        imageSrc: item.image.src,
        imageAlt: item.image.alt,
        tags: item.tags,
        allergens: item.allergens,
        available: item.available,
        featured: item.featured,
        kitchenMinutes: item.kitchenMinutes,
        sortOrder: index,
      })
      /*
       * Note what is NOT overwritten: `available`. Staff mark a dish sold out
       * during service, and a deploy an hour later must not quietly put it back
       * on sale. Everything else is the code's to define.
       */
      .onConflictDoUpdate({
        target: t.menuItems.id,
        set: {
          slug: item.slug,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          basePrice: item.basePrice,
          imageSrc: item.image.src,
          imageAlt: item.image.alt,
          tags: item.tags,
          allergens: item.allergens,
          featured: item.featured,
          kitchenMinutes: item.kitchenMinutes,
          sortOrder: index,
        },
      });

    /*
     * Option groups are replaced wholesale for the item, because they are a
     * single composed definition from `data/option-groups.ts` and there is no
     * runtime editor for them. Scoped to this item, so nothing else is touched.
     */
    await db.delete(t.optionGroups).where(eq(t.optionGroups.menuItemId, item.id));

    for (const [groupIndex, group] of item.optionGroups.entries()) {
      const groupRowId = `${item.id}::${group.id}`;
      await db.insert(t.optionGroups).values({
        id: groupRowId,
        menuItemId: item.id,
        name: group.name,
        description: group.description ?? null,
        selection: group.selection,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: groupIndex,
      });

      for (const [optionIndex, option] of group.options.entries()) {
        await db.insert(t.menuOptions).values({
          id: `${groupRowId}::${option.id}`,
          optionGroupId: groupRowId,
          name: option.name,
          priceDelta: option.priceDelta,
          available: option.available,
          isDefault: option.isDefault ?? false,
          sortOrder: optionIndex,
        });
      }
    }
  }

  /*
   * The permission catalogue, mirrored for anyone reading the database
   * directly. `lib/staff/permissions.ts` stays the authority on what the
   * application checks — see the note on the `permissions` table about why
   * `role_permissions` deliberately has no foreign key to this.
   */
  for (const group of PERMISSION_CATALOGUE) {
    for (const permission of group.permissions) {
      await db
        .insert(t.permissions)
        .values({
          id: permission.id,
          groupName: group.label,
          label: permission.label,
          description: permission.description,
        })
        .onConflictDoUpdate({
          target: t.permissions.id,
          set: {
            groupName: group.label,
            label: permission.label,
            description: permission.description,
          },
        });
    }
  }
}

/* ── Data migrations ──────────────────────────────────────────────────────── */

/**
 * The role ids the application seeds.
 *
 * Referenced here and nowhere else — no check anywhere asks whether someone
 * holds `role_manager`. If one did, a restaurant could not rename or replace
 * the role, which is the point of the whole system.
 */
const SEED_ROLE_MANAGER = "role_manager";
const SEED_ROLE_KITCHEN = "role_kitchen";
const SEED_ROLE_DELIVERY = "role_delivery";

const KITCHEN_PERMISSIONS = [
  "orders.view",
  "orders.status.preparing",
  "orders.status.ready",
];

const DELIVERY_PERMISSIONS = [
  "deliveries.view",
  "deliveries.accept",
  "deliveries.out_for_delivery",
  "deliveries.confirm_delivery",
];

interface DataMigration {
  version: number;
  name: string;
  run: (tx: Tx, now: Date) => Promise<void>;
}

const MIGRATIONS: DataMigration[] = [
  {
    version: 1,
    name: "Seed the initial roles and migrate the shared passcode to a manager account",
    run: async (tx, now) => {
      const role = async (
        id: string,
        name: string,
        description: string,
        permissions: string[],
      ) => {
        await tx
          .insert(t.roles)
          .values({ id, name, description, builtIn: true, createdAt: now, updatedAt: now })
          .onConflictDoNothing();
        for (const permission of permissions) {
          await tx
            .insert(t.rolePermissions)
            .values({ roleId: id, permission })
            .onConflictDoNothing();
        }
      };

      await role(
        SEED_ROLE_MANAGER,
        "Manager",
        "Runs the restaurant. Holds every permission this build knows about, including the ones that hand out permissions.",
        [...ALL_PERMISSIONS].sort(),
      );
      await role(
        SEED_ROLE_KITCHEN,
        "Kitchen Staff",
        "Cooks the food. Sees the order queue and moves orders through preparing and ready — nothing else.",
        [...KITCHEN_PERMISSIONS],
      );
      await role(
        SEED_ROLE_DELIVERY,
        "Delivery Staff",
        "Takes the food out. Claims a delivery, marks it under way and confirms it — on their own runs only.",
        [...DELIVERY_PERMISSIONS],
      );

      /*
       * The account that inherits the old shared passcode.
       *
       * Before the RBAC system existed, staff access was one passcode with no
       * identity behind it — `ADMIN_PASSCODE`, or a published default. That
       * passcode becomes this account's first password, so whoever had access
       * yesterday still has it today, now as a named account with a role and an
       * audit trail. It is hashed on the way in like any other password, so the
       * environment variable stops being a credential the application stores.
       */
      const legacyPasscode = process.env.ADMIN_PASSCODE ?? "urbantable";
      const username = (process.env.SEED_MANAGER_USERNAME ?? "manager")
        .trim()
        .toLowerCase();

      await tx
        .insert(t.staff)
        .values({
          id: "staff_seed_manager",
          username,
          name: "Restaurant Manager",
          passwordHash: await hashPassword(legacyPasscode),
          disabled: false,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      await tx
        .insert(t.staffRoles)
        .values({ staffId: "staff_seed_manager", roleId: SEED_ROLE_MANAGER })
        .onConflictDoNothing();
    },
  },
  /*
   * A later migration looks like this, and is how a new permission reaches
   * installs that already exist:
   *
   *   {
   *     version: 2,
   *     name: "Grant reports.view to roles that already administer the site",
   *     run: async (tx) => {
   *       await tx.execute(sql`
   *         INSERT INTO role_permissions (role_id, permission)
   *         SELECT role_id, 'reports.view' FROM role_permissions
   *         WHERE permission = 'roles.assign_permissions'
   *         ON CONFLICT DO NOTHING
   *       `);
   *     },
   *   }
   *
   * Note what it does NOT do: grant the new permission to everyone, or rewrite
   * a role wholesale. It adds one capability to the roles that already had the
   * authority to grant it to themselves anyway.
   */
];

/**
 * Runs any data migration that has not run yet, in one transaction each.
 *
 * The advisory lock is what makes this safe to call from every instance at
 * once during a rolling deploy: whichever process gets there first runs the
 * step, the rest wait and then find it already recorded. Without it, two
 * instances booting together would both see version 0 and both try to seed.
 */
export async function runDataMigrations(db: Db = getDb()): Promise<number[]> {
  const applied: number[] = [];

  for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('urban-table.data-migrations'))`);

      const already = await tx
        .select({ version: t.dataMigrations.version })
        .from(t.dataMigrations)
        .where(eq(t.dataMigrations.version, migration.version));
      if (already.length > 0) return;

      await migration.run(tx, new Date());
      await tx
        .insert(t.dataMigrations)
        .values({ version: migration.version, name: migration.name });
      applied.push(migration.version);
    });
  }

  return applied;
}

/* ── Development demo data ────────────────────────────────────────────────── */

/**
 * Extra accounts for looking at the staff area, created only when asked for.
 *
 * NOT run by `db:seed`. `npm run db:seed:demo` creates them, and the passwords
 * are the obviously-fake strings below rather than anything a person would
 * reuse. Nothing here runs in production: it refuses outright when NODE_ENV is
 * production, because a known-password account on a live till is a back door
 * however clearly it is labelled.
 */
const DEMO_ACCOUNTS = [
  { id: "staff_demo_kitchen", username: "demo-kitchen", name: "Demo Kitchen", roleId: SEED_ROLE_KITCHEN },
  { id: "staff_demo_driver", username: "demo-driver", name: "Demo Driver", roleId: SEED_ROLE_DELIVERY },
];

/** Obviously development-only, and printed to the console rather than hidden. */
const DEMO_PASSWORD = "demo-only-not-a-real-password";

export async function seedDemoStaff(db: Db = getDb()): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to create demo accounts in production.");
  }

  const now = new Date();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const account of DEMO_ACCOUNTS) {
    await db
      .insert(t.staff)
      .values({
        id: account.id,
        username: account.username,
        name: account.name,
        passwordHash,
        disabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(t.staffRoles)
      .values({ staffId: account.id, roleId: account.roleId })
      .onConflictDoNothing();
  }

  console.log("Demo staff accounts (development only):");
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.username} / ${DEMO_PASSWORD}`);
  }
}

/**
 * Everything a fresh database needs to serve the site.
 *
 * Idempotent, so it is safe on every boot and every deploy.
 */
export async function seed(db: Db = getDb()): Promise<void> {
  await syncCatalogue(db);
  await runDataMigrations(db);
}

/**
 * Empties every table. Development and tests only.
 *
 * `TRUNCATE … CASCADE` rather than dropping the schema, so the migration
 * history survives and the next run does not have to rebuild it. It refuses in
 * production, where the correct way to lose all the orders is to not.
 */
export async function resetDatabase(db: Db = getDb()): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "yes") {
    throw new Error(
      "Refusing to truncate the database in production. Set ALLOW_DB_RESET=yes if this really is what you want.",
    );
  }
  await db.execute(sql`
    TRUNCATE TABLE
      order_item_options, order_items, order_status_events, order_addresses,
      order_payments, order_refunds, delivery_assignments, orders,
      customers, menu_images, menu_options, option_groups, menu_items, categories,
      staff_sessions, staff_roles, staff, role_permissions, roles, permissions,
      audit_log, data_migrations
    RESTART IDENTITY CASCADE
  `);
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

if (process.argv[1]?.endsWith("seed.ts")) {
  const mode = process.argv[2] ?? "seed";
  const run = async () => {
    if (mode === "reset") {
      await resetDatabase();
      console.log("Database emptied.");
      await seed();
      console.log("Reseeded.");
    } else if (mode === "demo") {
      await seed();
      await seedDemoStaff();
    } else {
      await seed();
      console.log("Seeded.");
    }
  };
  run()
    .then(() => closeDb())
    .catch(async (error) => {
      console.error("Seed failed:", error);
      await closeDb();
      process.exit(1);
    });
}
