import { sql } from "drizzle-orm";
import { closeDb, getDb, isDatabaseConfigured } from "./client";
import { runMigrations } from "./migrate";
import { syncCatalogue, runDataMigrations } from "./seed";
import { forgetStaffDataCache } from "../staff/staff-repository";

/**
 * Giving each test a clean database. TESTS ONLY.
 *
 * These used to be unit tests against a Map, and `resetStore()` was a new Map.
 * They are integration tests now, because the thing being tested moved: an
 * order surviving a restart is not a property a fake can have, and a fake that
 * passed while Postgres failed would be worse than no test.
 *
 * ── What is truncated, and what is not ──────────────────────────────────────
 * The volatile tables — orders, staff, roles, sessions, audit — are emptied and
 * the data migrations re-run, so every test starts from the seeded roles and
 * the one manager account.
 *
 * The catalogue (categories, menu items, options, permissions) is seeded once
 * per process and only re-synced when a test dirtied it. Re-seeding 25 dishes
 * with their 225 options before each of 126 tests is around thirty thousand
 * statements, which turns a two-second suite into a two-minute one for no
 * additional confidence.
 */

let schemaReady = false;
let catalogueReady = false;

/** Marks the menu as dirtied, so the next reset restores it. */
export function menuWasModified(): void {
  catalogueReady = false;
}

/**
 * Which database the tests are allowed to empty.
 *
 * `TEST_DATABASE_URL` if it is set, and nothing else. Falling back to
 * `DATABASE_URL` is how `npm test` silently deletes the orders someone was
 * looking at in `npm run dev` — which happened once during this migration, to
 * me, and is the reason the fallback is a name check rather than a shrug.
 *
 * Without `TEST_DATABASE_URL`, `DATABASE_URL` is accepted only when its
 * database name says what it is: `urban_table_test`, `..._test`, or anything
 * containing "test". A database called `urban_table` is never truncated.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const fallback = process.env.DATABASE_URL?.trim();
  if (!fallback) {
    throw new Error(
      "These tests need a database. Set TEST_DATABASE_URL — see README.md → The database.",
    );
  }

  const name = fallback.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to empty "${name}": it does not look like a test database, and these tests truncate every table. ` +
        `Set TEST_DATABASE_URL to a database you are happy to lose — see README.md → The database.`,
    );
  }
  return fallback;
}

export function requireTestDatabase(): void {
  // Resolved once and pushed into DATABASE_URL, because the repositories under
  // test read that and are not going to be told about a second variable.
  const url = testDatabaseUrl();
  if (process.env.DATABASE_URL !== url) process.env.DATABASE_URL = url;
  if (!isDatabaseConfigured()) {
    throw new Error("These tests need a database. See README.md → The database.");
  }
}

export async function resetTestDatabase(): Promise<void> {
  requireTestDatabase();
  const db = getDb();

  if (!schemaReady) {
    await runMigrations();
    schemaReady = true;
  }

  await db.execute(sql`
    TRUNCATE TABLE
      order_item_options, order_items, order_status_events, order_addresses,
      order_payments, order_refunds, delivery_assignments, orders, customers,
      menu_images, staff_sessions, staff_roles, staff, role_permissions, roles,
      audit_log, data_migrations
    RESTART IDENTITY CASCADE
  `);

  if (!catalogueReady) {
    await db.execute(sql`
      TRUNCATE TABLE menu_item_translations, category_translations, menu_options, option_groups, menu_items, categories, permissions
      RESTART IDENTITY CASCADE
    `);
    await syncCatalogue(db);
    catalogueReady = true;
  }

  // The seed cache in the staff repository is per-process and we just deleted
  // what it remembers having written.
  forgetStaffDataCache();
  await runDataMigrations(db);
}

export async function closeTestDatabase(): Promise<void> {
  await closeDb();
}
