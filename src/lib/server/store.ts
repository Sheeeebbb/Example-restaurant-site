import type { MenuItem, Order } from "../types";
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
}

const STORE_KEY = Symbol.for("urban-table.server-store");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: ServerStore };

function createStore(): ServerStore {
  return {
    orders: new Map(),
    // A deep copy: the seed module is the factory default and must stay pristine
    // so a reset can restore it.
    menu: structuredClone(MENU_ITEMS),
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
