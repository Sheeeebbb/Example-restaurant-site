import { NextResponse } from "next/server";
import { STAFF_COOKIE, shouldUseSecureCookie } from "@/lib/admin/auth";
import { signIn, signOut } from "@/lib/staff/staff-repository";
import { currentActor } from "@/lib/staff/authorize";

/**
 * Staff sign-in and sign-out.
 *
 * Reachable without a session by design — it is how one is obtained — and the
 * only endpoint under `/api/admin` that is. Everything else requires a
 * permission; see `lib/staff/authorize.ts`.
 *
 * What crosses the wire on the way in is a username and a password, and neither
 * is stored: the password is verified against a scrypt digest and discarded
 * with the request. What crosses on the way back is a random token in an
 * httpOnly cookie — no role, no permissions, no staff id. There is nothing in
 * it worth editing, which is the point.
 */
export async function POST(request: Request) {
  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    username = body.username ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const session = await signIn(username, password);

  /*
   * One message for every kind of failure.
   *
   * "No such user", "wrong password" and "that account is disabled" are all
   * this sentence, because telling a stranger which one it was tells them
   * whether the username exists. `signIn` spends the same time on each for the
   * same reason.
   */
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "That username and password don't match an account." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Marked `Secure` whenever the request arrived over HTTPS, which is not the
    // same question as whether this is a production build. See `lib/admin/auth.ts`.
    secure: shouldUseSecureCookie(request),
    expires: new Date(session.expiresAt),
  });
  return response;
}

/**
 * Signs out.
 *
 * The session is deleted server-side, not merely un-cookied, so a token copied
 * out of a browser before signing out is dead too.
 */
export async function DELETE(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STAFF_COOKIE}=`))
    ?.slice(STAFF_COOKIE.length + 1);

  if (token) await signOut(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STAFF_COOKIE);
  return response;
}

/**
 * Who am I, and what may I do?
 *
 * The staff interface asks this to decide what to draw. It answers only about
 * the caller — their own name, roles and permissions — and it is not an
 * authorisation decision: every action they then attempt is checked again on
 * the server. A client that lies to itself about this response gets a prettier
 * interface and exactly the same refusals.
 */
export async function GET() {
  const actor = await currentActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    staff: { id: actor.staff.id, name: actor.staff.name, username: actor.staff.username },
    permissions: [...actor.permissions].sort(),
  });
}
