import type { MenuItem, Order } from "../types";
import type { AuditEntry, Role, StaffAccount, StaffSession } from "../staff/types";
import { MENU_ITEMS } from "../data/menu";

/**
 * The in-memory stand-in for a database.
 *
 * SERVER ONLY. This is the thing a real deployment replaces with Postgres, and
 * it is deliberately the *only* place mutable state lives on the server, so the
 * swap is one file rather than a hunt.
 *
 * ── Honest limitations ──────────────────────────────────────────────────────
 * State here is per-process and in-memory. It does not survive a server
 * restart, and it is not shared between instances behind a load balancer. That
 * is fine for a prototype demonstrating the flow, and unacceptable for a real
 * restaurant — which is exactly why the repositories in front of it expose an
 * async interface that a database can satisfy unchanged.
 *
 * ── Why globalThis ──────────────────────────────────────────────────────────
 * Next's dev server re-evaluates modules on hot reload. A plain module-level
 * `const` would be re-created on every edit, silently wiping every order placed
 * during a session. Caching on globalThis keeps it alive across reloads.
 *
 * ── The trade-off, and it bites in development ──────────────────────────────
 * The menu is seeded ONCE, the first time the store is touched. Editing
 * `data/menu.ts` therefore has no effect on a running dev server — it keeps
 * serving the copy it seeded at boot, and hot reload will not refresh it. This
 * is not obvious: renaming an image path and seeing the old one still served
 * looks like a rendering bug rather than a stale cache.
 *
 * Restart the dev server after editing menu data. In production the process
 * starts with the current module, so this only affects development.
 */

interface ServerStore {
  orders: Map<string, Order>;
  /** Seeded from the menu module, then mutated by staff. */
  menu: MenuItem[];
  /**
   * Dish photographs staff have uploaded, keyed by the id in their URL.
   *
   * Same lifetime as the menu edits they belong to: live immediately, gone on
   * restart. The photographs shipped with the site are files in `public/menu/`
   * and are not in here — see `lib/media/image-storage.ts`.
   */
  images: Map<string, { data: Uint8Array; contentType: string }>;

  /* ── Staff, roles and sessions ──────────────────────────────────────────
   *
   * Seeded and migrated by `lib/staff/staff-repository.ts` rather than here,
   * because unlike the menu they are not a static fixture: they carry data a
   * restaurant creates at runtime, and adding a permission to the catalogue
   * later has to reach existing installs without wiping what they changed. The
   * version below is what makes that possible.
   */
  roles: Map<string, Role>;
  staff: Map<string, StaffAccount>;
  /**
   * Live sessions, by token.
   *
   * Server-side, so signing out or disabling an account takes effect at once
   * and a client holding the cookie cannot outlive either. The client holds
   * nothing but the random token — no role, no permissions, nothing it could
   * usefully edit.
   */
  sessions: Map<string, StaffSession>;
  /** Newest last. Bounded — see `recordAudit`. */
  audit: AuditEntry[];
  /**
   * Which staff-data migrations have run.
   *
   * A real deployment reads this from a `schema_migrations` table; the shape of
   * the problem is identical and so is the answer, which is why it is modelled
   * rather than assumed away.
   */
  dataVersion: number;
}

const STORE_KEY = Symbol.for("urban-table.server-store");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: ServerStore };

function createStore(): ServerStore {
  return {
    orders: new Map(),
    // A deep copy: the seed module is the factory default and must stay pristine
    // so a reset can restore it.
    menu: structuredClone(MENU_ITEMS),
    images: new Map(),
    roles: new Map(),
    staff: new Map(),
    sessions: new Map(),
    audit: [],
    dataVersion: 0,
  };
}

export function getStore(): ServerStore {
  const globalRef = globalThis as GlobalWithStore;
  globalRef[STORE_KEY] ??= createStore();
  return globalRef[STORE_KEY];
}

/** Restores the factory menu and clears orders. Used by tests. */
export function resetStore(): void {
  (globalThis as GlobalWithStore)[STORE_KEY] = createStore();
}
