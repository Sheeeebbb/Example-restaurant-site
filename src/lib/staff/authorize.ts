import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STAFF_COOKIE } from "../admin/auth";
import { inArray } from "drizzle-orm";
import {
  permissionsFor,
  publicStaff,
  staffForToken,
} from "./staff-repository";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import type { PublicStaff } from "./types";

/**
 * Authorisation. SERVER ONLY.
 *
 * One function decides whether an action may happen, and every protected route
 * asks it before doing anything else. That is not a style preference: an
 * authorisation check that each handler implements for itself is an
 * authorisation check that a handler can implement differently, or forget, and
 * the forgotten one is the one that gets found.
 *
 * ── What is trusted ────────────────────────────────────────────────────────
 * The request carries exactly one thing: an opaque session token in an
 * httpOnly cookie. It carries no role, no permissions, no staff id, and there
 * is nothing in it a client could usefully edit — changing the token invalidates
 * it, and there is no other input to change. Everything else is looked up
 * server-side, per request, from the database:
 *
 *     cookie token -> session -> staff account -> roles -> permissions
 *
 * So a permission cannot be acquired by editing local storage, a cookie, a
 * request body, a URL, or React state, because none of those is consulted. A
 * `"role": "manager"` field in a request body is read by nothing.
 *
 * ── What the UI has to do with it ──────────────────────────────────────────
 * Nothing. The interface asks the same helpers so it can avoid offering what
 * would be refused, but hiding a button is a courtesy to the person, not a
 * control on the request. Every one of these checks runs again on the server
 * for every call, including calls that never went near the interface.
 */

export interface Actor {
  staff: PublicStaff;
  permissions: Set<string>;
  /**
   * The names of the roles this account holds, right now.
   *
   * Resolved here with the permissions, from the same store read, so anything
   * writing an audit record can say "Mike Brown (Delivery Staff)" without a
   * second lookup — and so what gets written is what was true at the moment of
   * the action rather than whenever the record is later read.
   */
  roleNames: string[];
  /** Convenience: `actor.can("orders.cancel")`. */
  can: (permission: string) => boolean;
}

/**
 * Who is making this request, or null.
 *
 * Reads the cookie through Next's own API rather than the `Request`, so it
 * works identically in a route handler and in a server component — the staff
 * pages need exactly the same answer as the endpoints they call.
 */
export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;

  const account = await staffForToken(token);
  if (!account) return null;

  /*
   * Permissions come back as one joined query rather than by loading every
   * role — see `permissionsFor`. The role NAMES are a second small query
   * because they are display only: they go into the status history so a line
   * still reads "Ana (Manager)" after Ana's roles change next month.
   */
  const permissions = await permissionsFor(account.id);
  const roleNames =
    account.roleIds.length > 0
      ? (
          await getDb()
            .select({ name: t.roles.name })
            .from(t.roles)
            .where(inArray(t.roles.id, account.roleIds))
        ).map((row) => row.name)
      : [];

  return {
    staff: publicStaff(account),
    permissions,
    roleNames,
    can: (permission: string) => permissions.has(permission),
  };
}

export type AuthorizationFailure = { ok: false; response: NextResponse };
export type AuthorizationSuccess = { ok: true; actor: Actor };
export type AuthorizationResult = AuthorizationSuccess | AuthorizationFailure;

/**
 * The gate every protected endpoint opens with.
 *
 * Returns either the actor or the response to send. Written that way rather
 * than as a thrown exception so the handler cannot accidentally continue: there
 * is no path through it that yields an actor without the permission.
 *
 *   const auth = await requirePermission("orders.cancel");
 *   if (!auth.ok) return auth.response;
 *
 * 401 and 403 are distinguished deliberately. "You are not signed in" is
 * recoverable by signing in; "you are signed in and this is not yours to do" is
 * not, and telling someone to log in again when the problem is their role wastes
 * a shift.
 */
export async function requirePermission(
  permission: string,
): Promise<AuthorizationResult> {
  const actor = await currentActor();

  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Sign in to continue." },
        { status: 401 },
      ),
    };
  }

  if (!actor.can(permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: `Your role doesn't include "${permission}". Ask a manager if you need it.`,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, actor };
}

/**
 * The same, for an endpoint that any one of several permissions would justify.
 *
 * Used where two roles reach the same action by different routes — a manager
 * setting any order out for delivery, and a driver setting out their own —
 * rather than inventing a third permission that means "either of those".
 */
export async function requireAnyPermission(
  permissions: string[],
): Promise<AuthorizationResult> {
  const actor = await currentActor();

  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Sign in to continue." },
        { status: 401 },
      ),
    };
  }

  if (!permissions.some((permission) => actor.can(permission))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: `Your role doesn't include any of: ${permissions.join(", ")}.`,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, actor };
}

/**
 * Signed in, whatever they can do.
 *
 * For the few endpoints whose answer is "what may I do?" — the session probe
 * the staff interface uses to decide what to draw. It returns the actor's own
 * permissions and nothing about anyone else.
 */
export async function requireSignedIn(): Promise<AuthorizationResult> {
  const actor = await currentActor();
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Sign in to continue." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, actor };
}

/** Re-exported so callers need one import for the whole gate. */
export { permissionsFor };
