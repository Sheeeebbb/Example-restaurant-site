import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { getDb, type Db, type Tx } from "../db/client";
import * as t from "../db/schema";
import { runDataMigrations } from "../db/seed";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { LOCKOUT_CRITICAL_PERMISSIONS, isKnownPermission } from "./permissions";
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
 * SERVER ONLY. Every write funnels through this file, which is what lets the
 * lock-out safeguard be real: `wouldLockOut` is consulted by each mutation that
 * could remove capability, not by whichever screen happened to trigger it.
 *
 * ── What changed when this moved to Postgres ────────────────────────────────
 * The shape of every function is the same; what is underneath is rows, so a
 * role a manager creates outlives the process that created it and is visible to
 * every instance behind a load balancer.
 *
 * The safeguards got stronger rather than merely surviving. Read-then-write
 * against a Map was safe because JavaScript is single-threaded and nothing
 * awaited in between; against a database, two managers on two instances can
 * interleave. So every check-then-write below runs inside a transaction that
 * first takes `rbacLock` — a Postgres advisory lock held to commit. Two
 * managers disabling the last two manager accounts at the same moment now
 * serialise, and the second one is refused, instead of both passing a check
 * that was true when each of them ran it.
 */

/**
 * Serialises the check-then-write mutations in this file.
 *
 * A transaction-scoped advisory lock: taken inside a transaction, released by
 * commit or rollback, held across instances because it lives in Postgres. It
 * costs one round trip on writes and nothing at all on reads, which never take
 * it — a stale read here just means a screen refreshes a moment later.
 */
async function rbacLock(tx: Tx): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('urban-table.rbac'))`);
}

/* ── Seeding and migrations ────────────────────────────────────────────────*/

/**
 * Brings the staff data up to date.
 *
 * Called by `currentActor` and by every repository read below, so no route has
 * to remember it. The work is in `db/seed.ts`, which records applied versions
 * in `data_migrations` and takes its own advisory lock — so this is idempotent
 * across processes, not merely within one.
 *
 * The in-process cache is an optimisation only: it saves a round trip per
 * request once the migrations are known to be applied, and correctness does not
 * depend on it.
 */
let migrated = false;
let migrating: Promise<void> | null = null;

export async function ensureStaffData(db: Db = getDb()): Promise<void> {
  if (migrated) return;
  migrating ??= runDataMigrations(db)
    .then(() => {
      migrated = true;
    })
    .finally(() => {
      migrating = null;
    });
  await migrating;
}

/** Tests reset the database underneath us; this forgets that we ever seeded it. */
export function forgetStaffDataCache(): void {
  migrated = false;
  migrating = null;
}

/* ── Row mapping ───────────────────────────────────────────────────────────*/

const iso = (date: Date | null | undefined): string | undefined =>
  date ? date.toISOString() : undefined;

async function rolesFrom(db: Db | Tx, rows: (typeof t.roles.$inferSelect)[]): Promise<Role[]> {
  if (rows.length === 0) return [];
  const grants = await db
    .select()
    .from(t.rolePermissions)
    .where(
      inArray(
        t.rolePermissions.roleId,
        rows.map((row) => row.id),
      ),
    );

  const byRole = new Map<string, string[]>();
  for (const grant of grants) {
    const bucket = byRole.get(grant.roleId);
    if (bucket) bucket.push(grant.permission);
    else byRole.set(grant.roleId, [grant.permission]);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    // Sorted here as well as on write, so the stored list reads the same
    // however it was produced and whatever order the rows came back in.
    permissions: (byRole.get(row.id) ?? []).sort(),
    builtIn: row.builtIn,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function staffFrom(
  db: Db | Tx,
  rows: (typeof t.staff.$inferSelect)[],
): Promise<StaffAccount[]> {
  if (rows.length === 0) return [];
  const assignments = await db
    .select()
    .from(t.staffRoles)
    .where(
      inArray(
        t.staffRoles.staffId,
        rows.map((row) => row.id),
      ),
    );

  const byStaff = new Map<string, string[]>();
  for (const assignment of assignments) {
    const bucket = byStaff.get(assignment.staffId);
    if (bucket) bucket.push(assignment.roleId);
    else byStaff.set(assignment.staffId, [assignment.roleId]);
  }

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    passwordHash: row.passwordHash,
    roleIds: byStaff.get(row.id) ?? [],
    disabled: row.disabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.lastSignedInAt ? { lastSignedInAt: row.lastSignedInAt.toISOString() } : {}),
  }));
}

/* ── Reading ───────────────────────────────────────────────────────────────*/

/** Strips the password digest. The only shape of a staff account that may leave. */
export function publicStaff(staff: StaffAccount): PublicStaff {
  const { passwordHash, ...rest } = staff;
  // Named and discarded rather than omitted, so adding a field to
  // `StaffAccount` that should not leave makes this line the place it is
  // noticed — the type of `rest` changes and `PublicStaff` stops matching.
  void passwordHash;
  return structuredClone(rest);
}

export async function listRoles(): Promise<Role[]> {
  const db = getDb();
  await ensureStaffData(db);
  const rows = await db.select().from(t.roles).orderBy(asc(t.roles.name));
  return rolesFrom(db, rows);
}

export async function getRole(id: string): Promise<Role | null> {
  const db = getDb();
  await ensureStaffData(db);
  const rows = await db.select().from(t.roles).where(eq(t.roles.id, id));
  return (await rolesFrom(db, rows))[0] ?? null;
}

export async function listStaff(): Promise<PublicStaff[]> {
  const db = getDb();
  await ensureStaffData(db);
  const rows = await db.select().from(t.staff).orderBy(asc(t.staff.name));
  return (await staffFrom(db, rows)).map(publicStaff);
}

export async function getStaff(id: string): Promise<PublicStaff | null> {
  const db = getDb();
  await ensureStaffData(db);
  const rows = await db.select().from(t.staff).where(eq(t.staff.id, id));
  const account = (await staffFrom(db, rows))[0];
  return account ? publicStaff(account) : null;
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

/**
 * One query rather than "load the account, then load every role".
 *
 * Runs on every authorised request, so it is the hot path of the whole staff
 * area: a join from the session's account through its roles to their grants,
 * returning the distinct permission strings and nothing else.
 */
export async function permissionsFor(staffId: string): Promise<Set<string>> {
  const db = getDb();
  await ensureStaffData(db);

  const rows = await db
    .selectDistinct({ permission: t.rolePermissions.permission })
    .from(t.staff)
    .innerJoin(t.staffRoles, eq(t.staffRoles.staffId, t.staff.id))
    .innerJoin(t.rolePermissions, eq(t.rolePermissions.roleId, t.staffRoles.roleId))
    .where(and(eq(t.staff.id, staffId), eq(t.staff.disabled, false)));

  return new Set(rows.map((row) => row.permission));
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
export function wouldLockOut(staff: StaffAccount[], roles: Role[]): string | null {
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

/**
 * The state as it stands, read inside the caller's transaction.
 *
 * Reading it here rather than outside is what makes the simulation trustworthy:
 * under `rbacLock` nothing else can change these rows between this read and the
 * write that follows.
 */
async function currentState(tx: Tx): Promise<{ staff: StaffAccount[]; roles: Role[] }> {
  // Sequential: `tx` is one connection, and two queries at once on it
  // interleave on the wire. See the note in db/order-queries.ts.
  const staffRows = await tx.select().from(t.staff);
  const roleRows = await tx.select().from(t.roles);
  return {
    staff: await staffFrom(tx, staffRows),
    roles: await rolesFrom(tx, roleRows),
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

/** Replaces a role's grants. Delete-then-insert, inside the caller's transaction. */
async function writePermissions(
  tx: Tx,
  roleId: string,
  permissions: string[],
): Promise<void> {
  await tx.delete(t.rolePermissions).where(eq(t.rolePermissions.roleId, roleId));
  if (permissions.length > 0) {
    await tx
      .insert(t.rolePermissions)
      .values(permissions.map((permission) => ({ roleId, permission })));
  }
}

export async function createRole(input: {
  name: string;
  description?: string;
  permissions?: string[];
}): Promise<StaffWriteResult<Role>> {
  const db = getDb();
  await ensureStaffData(db);

  const name = input.name?.trim() ?? "";
  if (name.length < 2 || name.length > 60) {
    return { ok: false, status: 422, error: "Give the role a name of 2–60 characters." };
  }

  return db.transaction(async (tx) => {
    await rbacLock(tx);

    const clash = await tx
      .select({ id: t.roles.id })
      .from(t.roles)
      .where(sql`lower(${t.roles.name}) = ${name.toLowerCase()}`);
    if (clash.length > 0) {
      return { ok: false, status: 409, error: `There is already a role called "${name}".` };
    }

    const id = `role_${randomUUID()}`;
    const now = new Date();
    await tx.insert(t.roles).values({
      id,
      name,
      description: (input.description ?? "").trim().slice(0, 300),
      builtIn: false,
      createdAt: now,
      updatedAt: now,
    });
    await writePermissions(tx, id, cleanPermissions(input.permissions));

    const rows = await tx.select().from(t.roles).where(eq(t.roles.id, id));
    return { ok: true, value: (await rolesFrom(tx, rows))[0] };
  });
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string; permissions?: string[] },
): Promise<StaffWriteResult<Role>> {
  const db = getDb();
  await ensureStaffData(db);

  return db.transaction(async (tx) => {
    await rbacLock(tx);

    const existingRows = await tx.select().from(t.roles).where(eq(t.roles.id, id));
    if (existingRows.length === 0) {
      return { ok: false, status: 404, error: "No such role." };
    }
    const existing = (await rolesFrom(tx, existingRows))[0];
    const next: Role = { ...existing, updatedAt: new Date().toISOString() };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2 || name.length > 60) {
        return { ok: false, status: 422, error: "Give the role a name of 2–60 characters." };
      }
      const clash = await tx
        .select({ id: t.roles.id })
        .from(t.roles)
        .where(and(ne(t.roles.id, id), sql`lower(${t.roles.name}) = ${name.toLowerCase()}`));
      if (clash.length > 0) {
        return { ok: false, status: 409, error: `There is already a role called "${name}".` };
      }
      next.name = name;
    }

    if (input.description !== undefined) {
      next.description = input.description.trim().slice(0, 300);
    }

    if (input.permissions !== undefined) {
      next.permissions = cleanPermissions(input.permissions);

      const state = await currentState(tx);
      const locked = wouldLockOut(
        state.staff,
        state.roles.map((role) => (role.id === id ? next : role)),
      );
      if (locked) return lockOutRefusal(locked);
    }

    await tx
      .update(t.roles)
      .set({ name: next.name, description: next.description, updatedAt: new Date() })
      .where(eq(t.roles.id, id));
    if (input.permissions !== undefined) {
      await writePermissions(tx, id, next.permissions);
    }

    const rows = await tx.select().from(t.roles).where(eq(t.roles.id, id));
    return { ok: true, value: (await rolesFrom(tx, rows))[0] };
  });
}

export async function deleteRole(id: string): Promise<StaffWriteResult<Role>> {
  const db = getDb();
  await ensureStaffData(db);

  return db.transaction(async (tx) => {
    await rbacLock(tx);

    const existingRows = await tx.select().from(t.roles).where(eq(t.roles.id, id));
    if (existingRows.length === 0) {
      return { ok: false, status: 404, error: "No such role." };
    }
    const existing = (await rolesFrom(tx, existingRows))[0];

    if (existing.builtIn) {
      return {
        ok: false,
        status: 409,
        error: `"${existing.name}" is one of the roles this system ships with and can't be deleted. Change what it allows instead, or stop assigning it.`,
      };
    }

    const holders = await tx
      .select({ staffId: t.staffRoles.staffId })
      .from(t.staffRoles)
      .where(eq(t.staffRoles.roleId, id));
    if (holders.length > 0) {
      return {
        ok: false,
        status: 409,
        error: `${holders.length} staff ${holders.length === 1 ? "member holds" : "members hold"} this role. Move them to another role first.`,
      };
    }

    const state = await currentState(tx);
    const locked = wouldLockOut(
      state.staff,
      state.roles.filter((role) => role.id !== id),
    );
    if (locked) return lockOutRefusal(locked);

    // The grants go with it — ON DELETE CASCADE on role_permissions.
    await tx.delete(t.roles).where(eq(t.roles.id, id));
    return { ok: true, value: existing };
  });
}

/* ── Staff accounts ────────────────────────────────────────────────────────*/

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export async function createStaff(input: {
  username: string;
  name: string;
  password: string;
  roleIds?: string[];
}): Promise<StaffWriteResult<PublicStaff>> {
  const db = getDb();
  await ensureStaffData(db);

  const username = (input.username ?? "").trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      status: 422,
      error: "Usernames are 3–32 characters: letters, digits, dots, dashes and underscores.",
    };
  }

  const name = (input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, status: 422, error: "Give the staff member a name of 2–80 characters." };
  }

  // Hashed before the transaction: scrypt takes about a tenth of a second by
  // design, and holding the RBAC lock through it would serialise every other
  // manager's write behind it for no reason.
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    await rbacLock(tx);

    const taken = await tx
      .select({ id: t.staff.id })
      .from(t.staff)
      .where(eq(t.staff.username, username));
    if (taken.length > 0) {
      return { ok: false, status: 409, error: `"${username}" is already taken.` };
    }

    const wanted = [...new Set(input.roleIds ?? [])];
    const realRoles =
      wanted.length > 0
        ? await tx.select({ id: t.roles.id }).from(t.roles).where(inArray(t.roles.id, wanted))
        : [];

    const id = `staff_${randomUUID()}`;
    const now = new Date();
    await tx.insert(t.staff).values({
      id,
      username,
      name,
      passwordHash,
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    if (realRoles.length > 0) {
      await tx
        .insert(t.staffRoles)
        .values(realRoles.map((role) => ({ staffId: id, roleId: role.id })));
    }

    const rows = await tx.select().from(t.staff).where(eq(t.staff.id, id));
    return { ok: true, value: publicStaff((await staffFrom(tx, rows))[0]) };
  });
}

export async function updateStaff(
  id: string,
  input: { name?: string; roleIds?: string[]; password?: string; disabled?: boolean },
): Promise<StaffWriteResult<PublicStaff>> {
  const db = getDb();
  await ensureStaffData(db);

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) {
      return { ok: false, status: 422, error: "Give the staff member a name of 2–80 characters." };
    }
  }

  // Outside the transaction, for the same reason as in `createStaff`.
  const passwordHash =
    input.password !== undefined ? await hashPassword(input.password) : undefined;

  return db.transaction(async (tx) => {
    await rbacLock(tx);

    const existingRows = await tx.select().from(t.staff).where(eq(t.staff.id, id));
    if (existingRows.length === 0) {
      return { ok: false, status: 404, error: "No such staff account." };
    }
    const existing = (await staffFrom(tx, existingRows))[0];
    const next: StaffAccount = { ...existing, updatedAt: new Date().toISOString() };

    if (input.name !== undefined) next.name = input.name.trim();
    if (passwordHash !== undefined) next.passwordHash = passwordHash;
    if (input.disabled !== undefined) next.disabled = input.disabled;

    if (input.roleIds !== undefined) {
      const wanted = [...new Set(input.roleIds)];
      const realRoles =
        wanted.length > 0
          ? await tx.select({ id: t.roles.id }).from(t.roles).where(inArray(t.roles.id, wanted))
          : [];
      next.roleIds = realRoles.map((role) => role.id);
    }

    // Simulate before writing: changing roles and disabling an account are the
    // two ways a manager can lock the restaurant out of its own back office.
    if (input.roleIds !== undefined || input.disabled !== undefined) {
      const state = await currentState(tx);
      const locked = wouldLockOut(
        state.staff.map((account) => (account.id === id ? next : account)),
        state.roles,
      );
      if (locked) return lockOutRefusal(locked);
    }

    await tx
      .update(t.staff)
      .set({
        name: next.name,
        disabled: next.disabled,
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        updatedAt: new Date(),
      })
      .where(eq(t.staff.id, id));

    if (input.roleIds !== undefined) {
      await tx.delete(t.staffRoles).where(eq(t.staffRoles.staffId, id));
      if (next.roleIds.length > 0) {
        await tx
          .insert(t.staffRoles)
          .values(next.roleIds.map((roleId) => ({ staffId: id, roleId })));
      }
    }

    /*
     * A password change or a disable ends that account's sessions.
     *
     * Without this, "disable this account" would mean "stop them signing in
     * again", which is not what anyone reaching for it means when an account
     * has been compromised or someone has walked out mid-shift. In the same
     * transaction as the change, so there is no instant where the account is
     * disabled and its sessions still work.
     */
    if (passwordHash !== undefined || input.disabled === true) {
      await tx.delete(t.staffSessions).where(eq(t.staffSessions.staffId, id));
    }

    const rows = await tx.select().from(t.staff).where(eq(t.staff.id, id));
    return { ok: true, value: publicStaff((await staffFrom(tx, rows))[0]) };
  });
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
  const db = getDb();
  await ensureStaffData(db);

  const rows = await db
    .select()
    .from(t.staff)
    .where(eq(t.staff.username, username.trim().toLowerCase()));
  const account = rows[0];

  const digest = account?.passwordHash ?? (await DUMMY_HASH_PROMISE);
  const matches = await verifyPassword(password, digest);
  if (!account || !matches || account.disabled) return null;

  if (needsRehash(account.passwordHash)) {
    await db
      .update(t.staff)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(t.staff.id, account.id));
  }

  const now = Date.now();
  const session = {
    token: randomBytes(32).toString("hex"),
    staffId: account.id,
    createdAt: new Date(now),
    expiresAt: new Date(now + SESSION_HOURS * 3_600_000),
  };

  await db.transaction(async (tx) => {
    await tx.insert(t.staffSessions).values(session);
    await tx
      .update(t.staff)
      .set({ lastSignedInAt: new Date(now) })
      .where(eq(t.staff.id, account.id));
    /*
     * Expired rows for this account, swept on the way past. Sessions are the
     * one table that grows without bound on its own, and clearing the ones
     * belonging to whoever just signed in costs nothing and needs no cron.
     */
    await tx
      .delete(t.staffSessions)
      .where(
        and(eq(t.staffSessions.staffId, account.id), lt(t.staffSessions.expiresAt, new Date(now))),
      );
  });

  return {
    token: session.token,
    staffId: session.staffId,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
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
  await getDb().delete(t.staffSessions).where(eq(t.staffSessions.token, token));
}

/** The account a token belongs to, or null if it is unknown, expired or disabled. */
export async function staffForToken(token: string): Promise<StaffAccount | null> {
  const db = getDb();
  await ensureStaffData(db);

  const rows = await db
    .select({ session: t.staffSessions, account: t.staff })
    .from(t.staffSessions)
    .innerJoin(t.staff, eq(t.staff.id, t.staffSessions.staffId))
    .where(eq(t.staffSessions.token, token));

  const row = rows[0];
  if (!row) return null;

  // Expired or disabled: drop the row rather than leaving it to be re-checked
  // on every request for the next eight hours.
  if (row.session.expiresAt.getTime() <= Date.now() || row.account.disabled) {
    await db.delete(t.staffSessions).where(eq(t.staffSessions.token, token));
    return null;
  }

  return (await staffFrom(db, [row.account]))[0];
}

/* ── Audit ─────────────────────────────────────────────────────────────────*/

/**
 * One line of the record of who did what.
 *
 * Fire-and-forget by design: the caller does not await it, because an audit
 * write must never be the reason an order fails to cancel. A failure is logged
 * server-side and swallowed — losing a log line is bad, losing the cancellation
 * it describes is worse.
 *
 * It stays synchronous-looking for exactly that reason, so every existing call
 * site is unchanged and none of them can accidentally start blocking on it.
 */
export function recordAudit(entry: Omit<AuditEntry, "id" | "at">): void {
  void getDb()
    .insert(t.auditLog)
    .values({ ...entry, id: `aud_${randomUUID()}`, at: new Date() })
    .catch((error) => {
      console.error("[audit] failed to record:", entry.action, entry.subject, error);
    });
}

/**
 * Newest first.
 *
 * No longer capped at the last 500 the way the in-memory version was — that
 * bound existed because the array lived in a process's heap. A table can hold
 * a restaurant's whole history, and `LIMIT` decides what a page shows.
 */
export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const db = getDb();
  await ensureStaffData(db);

  const rows = await db
    .select()
    .from(t.auditLog)
    .orderBy(desc(t.auditLog.at))
    .limit(Math.min(Math.max(limit, 1), 1000));

  return rows.map((row) => ({
    id: row.id,
    at: row.at.toISOString(),
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    subject: row.subject,
    summary: row.summary,
  }));
}

export { iso };
