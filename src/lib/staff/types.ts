import type { IsoDateTime } from "../types";

/**
 * The RBAC data model.
 *
 * Three records and one rule: staff hold roles, roles hold permissions,
 * permissions decide what may happen. Nothing in the application branches on a
 * role's name or id — if it did, the restaurant could not invent a role.
 */

export interface Role {
  id: string;
  name: string;
  description: string;
  /**
   * Permission ids from the catalogue.
   *
   * Stored as plain strings, and read back even when this build does not
   * recognise one: a role written by a newer version must survive being loaded
   * and saved by an older one rather than silently losing grants.
   */
  permissions: string[];
  /**
   * True for the roles the application seeds.
   *
   * It changes exactly two things — they cannot be deleted, and the interface
   * says where they came from — and NOT what they allow. A manager can edit a
   * built-in role's permissions freely; the lock-out check is what stops that
   * going too far, not this flag.
   */
  builtIn: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface StaffAccount {
  id: string;
  /** What they type to sign in. Lower-cased, unique, no spaces. */
  username: string;
  /** Their name as colleagues see it. */
  name: string;
  /**
   * A scrypt digest — never the password, and never sent anywhere.
   *
   * Excluded from every API response by `publicStaff()`, which is the only
   * shape that leaves this module. See `password.ts` for the format.
   */
  passwordHash: string;
  /**
   * The roles this account holds, by id.
   *
   * Multiple, because a real restaurant has a shift manager who also drives on
   * Fridays, and giving them one inflated role is how permissions creep.
   * Combining is a plain union — no precedence, no negative permissions, no
   * ordering. That is what makes the effective set predictable: adding a role
   * can only ever add capability, so nobody has to reason about which of two
   * roles "wins".
   */
  roleIds: string[];
  /** Disabled accounts keep their history but cannot sign in. */
  disabled: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  lastSignedInAt?: IsoDateTime;
}

/** What may leave the server. Note the absence of `passwordHash`. */
export type PublicStaff = Omit<StaffAccount, "passwordHash">;

export interface StaffSession {
  /** 32 random bytes, hex. The cookie value, and the only thing the client holds. */
  token: string;
  staffId: string;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
}

/**
 * One line of the record of who did what.
 *
 * Deliberately narrow: who, what, which record, when, and a short human
 * summary. No request bodies, no customer personal data, no payment details
 * beyond the provider's own reference — an audit log that accumulates
 * everything becomes a second copy of the database with none of its controls.
 */
export interface AuditEntry {
  id: string;
  at: IsoDateTime;
  /** The staff account that did it, and their name at the time. */
  actorId: string;
  actorName: string;
  /** A dotted verb: "order.cancelled", "role.permissions_changed". */
  action: string;
  /** What it happened to: an order reference, a staff id, a role id. */
  subject: string;
  /** One sentence, already written for a person to read. */
  summary: string;
}
