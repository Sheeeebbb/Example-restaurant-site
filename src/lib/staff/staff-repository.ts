import { randomBytes, randomUUID } from "node:crypto";
import { getStore } from "../server/store";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import {
  ALL_PERMISSIONS,
  LOCKOUT_CRITICAL_PERMISSIONS,
  isKnownPermission,
} from "./permissions";
import type {
  AuditEntry,
  PublicStaff,
  Role,
  StaffAccount,
  StaffSession,
} from "./types";

/**
 * Staff, roles and sessions.
 *
 * SERVER ONLY, and async throughout even though it resolves from a Map — the
 * same rule the order and menu repositories follow, so a database swap changes
 * these bodies and nothing that calls them.
 *
 * Every write funnels through this file, which is what lets the lock-out
 * safeguard be real: `wouldLockOut` is consulted by each mutation that could
 * remove capability, not by whichever screen happened to trigger it.
 */

/* ── Seeding and migrations ─────────────────────────────────────────────────
 *
 * Modelled as an ordered list of steps with a recorded version, exactly as a
 * database would, rather than a one-shot "if empty, fill it". The difference
 * matters the moment this ships twice: step 1 must not re-run against an
 * install that has since renamed a role or removed a permission from it, and a
 * step added later must run against installs that already exist.
 *
 * Migrations are additive by construction — they create what is missing and
 * leave what is there. None of them deletes or overwrites staff-created data.
 */

interface Migration {
  version: number;
  name: string;
  run: (context: { now: string }) => Promise<void> | void;
}

/**
 * The role ids the application seeds.
 *
 * Referenced by the seed and by nothing else — no check anywhere asks whether
 * someone holds `role_manager`. If it did, a restaurant could not rename or
 * replace the role, which is the point of the whole system.
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

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "Seed the initial roles and migrate the shared passcode to a manager account",
    run: async ({ now }) => {
      const store = getStore();

      const role = (
        id: string,
        name: string,
        description: string,
        permissions: string[],
      ): Role => ({
        id,
        name,
        description,
        permissions,
        builtIn: true,
        createdAt: now,
        updatedAt: now,
      });

      store.roles.set(
        SEED_ROLE_MANAGER,
        role(
          SEED_ROLE_MANAGER,
          "Manager",
          "Runs the restaurant. Holds every permission this build knows about, including the ones that hand out permissions.",
          // Sorted, as `cleanPermissions` sorts every later write, so the
          // stored list reads the same however it was produced.
          [...ALL_PERMISSIONS].sort(),
        ),
      );
      store.roles.set(
        SEED_ROLE_KITCHEN,
        role(
          SEED_ROLE_KITCHEN,
          "Kitchen Staff",
          "Cooks the food. Sees the order queue and moves orders through preparing and ready — nothing else.",
          [...KITCHEN_PERMISSIONS],
        ),
      );
      store.roles.set(
        SEED_ROLE_DELIVERY,
        role(
          SEED_ROLE_DELIVERY,
          "Delivery Staff",
          "Takes the food out. Claims a delivery, marks it under way and confirms it — on their own runs only.",
          [...DELIVERY_PERMISSIONS],
        ),
      );

      /*
       * The account that inherits the old shared passcode.
       *
       * Before this system existed, staff access was one passcode with no
       * identity behind it — `ADMIN_PASSCODE`, or a published default. That
       * passcode becomes this account's first password, so whoever had access
       * yesterday still has it today, now as a named account with a role and
       * an audit trail. Nothing is lost and nothing is deleted; the shared
       * passcode simply stops being a way in on its own.
       *
       * It is hashed on the way in like any other password, so the environment
       * variable is no longer a credential the application stores.
       */
      const legacyPasscode = process.env.ADMIN_PASSCODE ?? "urbantable";
      const username = (process.env.SEED_MANAGER_USERNAME ?? "manager")
        .trim()
        .toLowerCase();

      store.staff.set("staff_seed_manager", {
        id: "staff_seed_manager",
        username,
        name: "Restaurant Manager",
        passwordHash: await hashPassword(legacyPasscode),
        roleIds: [SEED_ROLE_MANAGER],
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });
    },
  },
  /*
   * A later migration looks like this, and is how a new permission reaches
   * installs that already exist:
   *
   *   {
   *     version: 2,
   *     name: "Grant reports.view to roles that already administer the site",
   *     run: ({ now }) => {
   *       for (const role of getStore().roles.values()) {
   *         if (!role.permissions.includes("roles.assign_permissions")) continue;
   *         if (role.permissions.includes("reports.view")) continue;
   *         role.permissions = [...role.permissions, "reports.view"];
   *         role.updatedAt = now;
   *       }
   *     },
   *   }
   *
   * Note what it does NOT do: grant the new permission to everyone, or rewrite
   * a role wholesale. It adds one capability to the roles that already had the
   * authority to grant it to themselves anyway.
   */
];

/**
 * Brings the staff data up to date, once per process.
 *
 * Called by `currentActor` and by every repository read below, so no route has
 * to remember it. Idempotent: already-applied versions are skipped, and a
 * half-applied run resumes rather than starting over.
 */
let migrating: Promise<void> | null = null;

export async function ensureStaffData(): Promise<void> {
  const store = getStore();
  if (store.dataVersion >= MIGRATIONS[MIGRATIONS.length - 1].version) return;

  // One in-flight run per process. Two concurrent requests on a cold start
  // would otherwise both seed, and the second would overwrite the first.
  migrating ??= (async () => {
    const now = new Date().toISOString();
    for (const migration of MIGRATIONS) {
      if (store.dataVersion >= migration.version) continue;
      await migration.run({ now });
      store.dataVersion = migration.version;
    }
  })().finally(() => {
    migrating = null;
  });

  await migrating;
}

/* ── Reading ───────────────────────────────────────────────────────────────*/

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Strips the password digest. The only shape of a staff account that may leave. */
export function publicStaff(staff: StaffAccount): PublicStaff {
  const { passwordHash, ...rest } = staff;
  // Named and discarded rather than omitted, so adding a field to
  // `StaffAccount` that should not leave makes this line the place it is
  // noticed — the type of `rest` changes and `PublicStaff` stops matching.
  void passwordHash;
  return clone(rest);
}

export async function listRoles(): Promise<Role[]> {
  await ensureStaffData();
  return clone(
    [...getStore().roles.values()].sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function getRole(id: string): Promise<Role | null> {
  await ensureStaffData();
  const found = getStore().roles.get(id);
  return found ? clone(found) : null;
}

export async function listStaff(): Promise<PublicStaff[]> {
  await ensureStaffData();
  return [...getStore().staff.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(publicStaff);
}

export async function getStaff(id: string): Promise<PublicStaff | null> {
  await ensureStaffData();
  const found = getStore().staff.get(id);
  return found ? publicStaff(found) : null;
}

/**
 * The permissions an account actually has: the union of its roles'.
 *
 * A union, with no precedence and no way to subtract — see `StaffAccount.roleIds`.
 * Roles that no longer exist are skipped rather than throwing, so deleting a
 * role degrades an account's access instead of breaking its sign-in.
 */
export function resolvePermissions(
  staff: Pick<StaffAccount, "roleIds">,
  roles: Map<string, Role> | Role[],
): Set<string> {
  const index =
    roles instanceof Map ? roles : new Map(roles.map((role) => [role.id, role]));
  const permissions = new Set<string>();
  for (const roleId of staff.roleIds) {
    for (const permission of index.get(roleId)?.permissions ?? []) {
      permissions.add(permission);
    }
  }
  return permissions;
}

export async function permissionsFor(staffId: string): Promise<Set<string>> {
  await ensureStaffData();
  const store = getStore();
  const staff = store.staff.get(staffId);
  if (!staff || staff.disabled) return new Set();
  return resolvePermissions(staff, store.roles);
}

/* ── The lock-out safeguard ────────────────────────────────────────────────*/

/**
 * Would this change leave a critical permission held by nobody?
 *
 * Takes the state as it WOULD be — the caller passes the accounts and roles
 * after its change — and reports the first capability that no enabled account
 * would hold any more. Every mutation that can remove access runs this before
 * writing, which is why the safeguard cannot be walked around by choosing a
 * different screen: disabling the last manager, emptying their role, deleting
 * it, or removing it from their account all end here.
 *
 * Deliberately about capabilities rather than about a role called "Manager".
 * A restaurant that renames it, splits it in two, or moves these permissions to
 * a role of its own invention is still protected.
 */
export function wouldLockOut(
  staff: StaffAccount[],
  roles: Role[],
): string | null {
  const index = new Map(roles.map((role) => [role.id, role]));

  for (const permission of LOCKOUT_CRITICAL_PERMISSIONS) {
    const held = staff.some(
      (account) =>
        !account.disabled && resolvePermissions(account, index).has(permission),
    );
    if (!held) return permission;
  }
  return null;
}

/** The state as it stands, for a caller about to simulate a change to it. */
function currentState(): { staff: StaffAccount[]; roles: Role[] } {
  const store = getStore();
  return {
    staff: [...store.staff.values()].map(clone),
    roles: [...store.roles.values()].map(clone),
  };
}

export type StaffWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: 404 | 409 | 422 };

const lockOutRefusal = (permission: string): StaffWriteResult<never> => ({
  ok: false,
  status: 409,
  error: `Blocked: this would leave nobody able to "${permission}". At least one enabled account must keep it, or there would be no way to give anyone access again.`,
});

/* ── Roles ─────────────────────────────────────────────────────────────────*/

function cleanPermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  // Unknown ids are dropped rather than stored: a role may only grant things
  // this build can actually check, or it is promising access it cannot deliver.
  return [...new Set(input.filter((id): id is string => typeof id === "string"))]
    .filter(isKnownPermission)
    .sort();
}

export async function createRole(input: {
  name: string;
  description?: string;
  permissions?: string[];
}): Promise<StaffWriteResult<Role>> {
  await ensureStaffData();
  const name = input.name?.trim() ?? "";
  if (name.length < 2 || name.length > 60) {
    return { ok: false, status: 422, error: "Give the role a name of 2–60 characters." };
  }

  const store = getStore();
  if ([...store.roles.values()].some((role) => role.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, status: 409, error: `There is already a role called "${name}".` };
  }

  const now = new Date().toISOString();
  const role: Role = {
    id: `role_${randomUUID()}`,
    name,
    description: (input.description ?? "").trim().slice(0, 300),
    permissions: cleanPermissions(input.permissions),
    builtIn: false,
    createdAt: now,
    updatedAt: now,
  };
  store.roles.set(role.id, role);
  return { ok: true, value: clone(role) };
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string; permissions?: string[] },
): Promise<StaffWriteResult<Role>> {
  await ensureStaffData();
  const store = getStore();
  const existing = store.roles.get(id);
  if (!existing) return { ok: false, status: 404, error: "No such role." };

  const next: Role = { ...clone(existing), updatedAt: new Date().toISOString() };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) {
      return { ok: false, status: 422, error: "Give the role a name of 2–60 characters." };
    }
    const clash = [...store.roles.values()].some(
      (role) => role.id !== id && role.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) return { ok: false, status: 409, error: `There is already a role called "${name}".` };
    next.name = name;
  }

  if (input.description !== undefined) {
    next.description = input.description.trim().slice(0, 300);
  }

  if (input.permissions !== undefined) {
    next.permissions = cleanPermissions(input.permissions);

    const state = currentState();
    const locked = wouldLockOut(
      state.staff,
      state.roles.map((role) => (role.id === id ? next : role)),
    );
    if (locked) return lockOutRefusal(locked);
  }

  store.roles.set(id, next);
  return { ok: true, value: clone(next) };
}

export async function deleteRole(id: string): Promise<StaffWriteResult<Role>> {
  await ensureStaffData();
  const store = getStore();
  const existing = store.roles.get(id);
  if (!existing) return { ok: false, status: 404, error: "No such role." };

  if (existing.builtIn) {
    return {
      ok: false,
      status: 409,
      error: `"${existing.name}" is one of the roles this system ships with and can't be deleted. Change what it allows instead, or stop assigning it.`,
    };
  }

  const holders = [...store.staff.values()].filter((account) =>
    account.roleIds.includes(id),
  );
  if (holders.length > 0) {
    return {
      ok: false,
      status: 409,
      error: `${holders.length} staff ${holders.length === 1 ? "member holds" : "members hold"} this role. Move them to another role first.`,
    };
  }

  const state = currentState();
  const locked = wouldLockOut(
    state.staff,
    state.roles.filter((role) => role.id !== id),
  );
  if (locked) return lockOutRefusal(locked);

  store.roles.delete(id);
  return { ok: true, value: clone(existing) };
}

/* ── Staff accounts ────────────────────────────────────────────────────────*/

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export async function createStaff(input: {
  username: string;
  name: string;
  password: string;
  roleIds?: string[];
}): Promise<StaffWriteResult<PublicStaff>> {
  await ensureStaffData();
  const store = getStore();

  const username = (input.username ?? "").trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      status: 422,
      error: "Usernames are 3–32 characters: letters, digits, dots, dashes and underscores.",
    };
  }
  if ([...store.staff.values()].some((account) => account.username === username)) {
    return { ok: false, status: 409, error: `"${username}" is already taken.` };
  }

  const name = (input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, status: 422, error: "Give the staff member a name of 2–80 characters." };
  }

  const roleIds = [...new Set(input.roleIds ?? [])].filter((roleId) =>
    store.roles.has(roleId),
  );

  const now = new Date().toISOString();
  const account: StaffAccount = {
    id: `staff_${randomUUID()}`,
    username,
    name,
    passwordHash: await hashPassword(input.password),
    roleIds,
    disabled: false,
    createdAt: now,
    updatedAt: now,
  };
  store.staff.set(account.id, account);
  return { ok: true, value: publicStaff(account) };
}

export async function updateStaff(
  id: string,
  input: { name?: string; roleIds?: string[]; password?: string; disabled?: boolean },
): Promise<StaffWriteResult<PublicStaff>> {
  await ensureStaffData();
  const store = getStore();
  const existing = store.staff.get(id);
  if (!existing) return { ok: false, status: 404, error: "No such staff account." };

  const next: StaffAccount = { ...clone(existing), updatedAt: new Date().toISOString() };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) {
      return { ok: false, status: 422, error: "Give the staff member a name of 2–80 characters." };
    }
    next.name = name;
  }

  if (input.roleIds !== undefined) {
    next.roleIds = [...new Set(input.roleIds)].filter((roleId) => store.roles.has(roleId));
  }

  if (input.password !== undefined) {
    next.passwordHash = await hashPassword(input.password);
  }

  if (input.disabled !== undefined) {
    next.disabled = input.disabled;
  }

  // Simulate before writing: changing roles and disabling an account are the
  // two ways a manager can lock the restaurant out of its own back office.
  if (input.roleIds !== undefined || input.disabled !== undefined) {
    const state = currentState();
    const locked = wouldLockOut(
      state.staff.map((account) => (account.id === id ? next : account)),
      state.roles,
    );
    if (locked) return lockOutRefusal(locked);
  }

  store.staff.set(id, next);

  /*
   * A password change or a disable ends that account's sessions.
   *
   * Without this, "disable this account" would mean "stop them signing in
   * again", which is not what anyone reaching for it means when an account has
   * been compromised or someone has walked out mid-shift.
   */
  if (input.password !== undefined || input.disabled === true) {
    for (const [token, session] of store.sessions) {
      if (session.staffId === id) store.sessions.delete(token);
    }
  }

  return { ok: true, value: publicStaff(next) };
}

/* ── Sessions ──────────────────────────────────────────────────────────────*/

const SESSION_HOURS = 8;

/**
 * Signs a staff member in.
 *
 * Returns a token, or null — never a reason. Which of "no such user", "wrong
 * password" and "disabled" it was is not the caller's business to relay: an
 * unauthenticated stranger learning that a username exists is the first step of
 * a targeted guess.
 *
 * A password is verified even when the username does not exist, against a
 * throwaway digest, so the response takes about the same time either way and
 * cannot be used to enumerate accounts.
 */
export async function signIn(
  username: string,
  password: string,
): Promise<StaffSession | null> {
  await ensureStaffData();
  const store = getStore();
  const account = [...store.staff.values()].find(
    (candidate) => candidate.username === username.trim().toLowerCase(),
  );

  const digest = account?.passwordHash ?? (await DUMMY_HASH_PROMISE);
  const matches = await verifyPassword(password, digest);
  if (!account || !matches || account.disabled) return null;

  if (needsRehash(account.passwordHash)) {
    account.passwordHash = await hashPassword(password);
  }
  account.lastSignedInAt = new Date().toISOString();

  const now = Date.now();
  const session: StaffSession = {
    token: randomBytes(32).toString("hex"),
    staffId: account.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_HOURS * 3_600_000).toISOString(),
  };
  store.sessions.set(session.token, session);
  return clone(session);
}

/**
 * A well-formed digest of a password nobody holds.
 *
 * Verified against when the username does not exist, so the work done — and
 * therefore the time taken — is the same whether or not the account is real.
 * Without it, "no such user" would return in microseconds and "wrong password"
 * in a tenth of a second, which is a list of every username on the system to
 * anyone willing to time the difference.
 *
 * Built from a random password at module load, so it can never accidentally
 * match anything.
 */
const DUMMY_HASH_PROMISE = hashPassword(randomBytes(32).toString("hex"));

export async function signOut(token: string): Promise<void> {
  getStore().sessions.delete(token);
}

/** The account a token belongs to, or null if it is unknown, expired or disabled. */
export async function staffForToken(token: string): Promise<StaffAccount | null> {
  await ensureStaffData();
  const store = getStore();
  const session = store.sessions.get(token);
  if (!session) return null;

  if (Date.parse(session.expiresAt) <= Date.now()) {
    store.sessions.delete(token);
    return null;
  }

  const account = store.staff.get(session.staffId);
  if (!account || account.disabled) {
    store.sessions.delete(token);
    return null;
  }
  return account;
}

/* ── Audit ─────────────────────────────────────────────────────────────────*/

/** Kept to the recent past: this is an in-memory prototype, not a log store. */
const AUDIT_LIMIT = 500;

export function recordAudit(
  entry: Omit<AuditEntry, "id" | "at">,
): void {
  const store = getStore();
  store.audit.push({ ...entry, id: `aud_${randomUUID()}`, at: new Date().toISOString() });
  if (store.audit.length > AUDIT_LIMIT) {
    store.audit.splice(0, store.audit.length - AUDIT_LIMIT);
  }
}

/** Newest first. */
export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  await ensureStaffData();
  return clone(getStore().audit.slice(-limit).reverse());
}
