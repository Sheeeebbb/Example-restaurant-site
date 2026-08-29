import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The database connection. SERVER ONLY.
 *
 * ── Credentials ─────────────────────────────────────────────────────────────
 * Read from `DATABASE_URL` and nowhere else. Never `NEXT_PUBLIC_` — that
 * prefix ships a value to every visitor's browser, and a connection string
 * contains a password. Nothing in `src/lib/db` may be imported from a client
 * component; the browser reaches data through route handlers.
 *
 * ── Pooling, and why it is cached on globalThis ─────────────────────────────
 * A pool holds real sockets. Next's dev server re-evaluates modules on every
 * hot reload, so a plain module-level pool would leak a new one per edit until
 * Postgres refused connections. The same trick the old in-memory store used,
 * for a much better reason: this caches a connection pool, not the data.
 *
 * The data itself now lives in Postgres, which is the point — it outlives this
 * process, this deployment, and any number of instances behind a load balancer.
 */

const POOL_KEY = Symbol.for("urban-table.pg-pool");
type GlobalWithPool = typeof globalThis & {
  [POOL_KEY]?: { pool: Pool; db: NodePgDatabase<typeof schema> };
};

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres instance — see README.md.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseNotConfiguredError();
  return url;
}

function create() {
  const pool = new Pool({
    connectionString: connectionString(),
    /*
     * Sized for a serverful deployment. Behind a serverless platform, where
     * every invocation is its own process, this wants to be 1 and a pooler
     * (PgBouncer, Neon, Supabase's) wants to sit in front — see README.
     */
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 10_000),
    ssl: sslOption(),
  });

  /*
   * An idle client erroring — the database restarted, a network blip — must not
   * take the process down. `pg` emits it here rather than throwing; without a
   * listener Node treats it as unhandled and exits.
   */
  pool.on("error", (error) => {
    console.error("[db] idle client error:", error.message);
  });

  return { pool, db: drizzle(pool, { schema }) };
}

/**
 * TLS, on unless told otherwise.
 *
 * `DATABASE_SSL=disable` for a local cluster over a unix socket or loopback.
 * `DATABASE_SSL=no-verify` for a managed provider whose certificate chain the
 * container does not carry — encrypted, but unauthenticated, so it is a
 * deliberate opt-in rather than a silent default.
 */
function sslOption(): false | { rejectUnauthorized: boolean } {
  const mode = (process.env.DATABASE_SSL ?? "").trim().toLowerCase();
  if (mode === "disable" || mode === "false" || mode === "off") return false;
  if (mode === "no-verify") return { rejectUnauthorized: false };
  if (mode === "require" || mode === "true" || mode === "on") {
    return { rejectUnauthorized: true };
  }
  // Unset: local connections are plain, anything else is verified TLS.
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.includes("host=/");
  return local ? false : { rejectUnauthorized: true };
}

export function getDb(): NodePgDatabase<typeof schema> {
  const globalRef = globalThis as GlobalWithPool;
  globalRef[POOL_KEY] ??= create();
  return globalRef[POOL_KEY].db;
}

export function getPool(): Pool {
  const globalRef = globalThis as GlobalWithPool;
  globalRef[POOL_KEY] ??= create();
  return globalRef[POOL_KEY].pool;
}

/** Whether a database is configured at all, without throwing to find out. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Closes the pool. For test teardown and graceful shutdown; not for request code. */
export async function closeDb(): Promise<void> {
  const globalRef = globalThis as GlobalWithPool;
  const existing = globalRef[POOL_KEY];
  if (!existing) return;
  delete globalRef[POOL_KEY];
  await existing.pool.end();
}

export { schema };
export type Db = NodePgDatabase<typeof schema>;
/** What a transaction callback receives. Same query surface as `Db`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
