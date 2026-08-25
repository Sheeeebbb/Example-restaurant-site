import { NextResponse } from "next/server";
import {
  STAFF_COOKIE,
  isValidPasscode,
  sessionCookieValue,
  shouldUseSecureCookie,
} from "@/lib/admin/auth";

/**
 * Staff sign-in and sign-out.
 *
 * Reachable without a session by design — it is how one is obtained. See the
 * warning in `lib/admin/auth.ts`: the cookie this sets is a constant, not a
 * token, and this is a demonstration gate rather than authentication.
 */
export async function POST(request: Request) {
  let passcode = "";
  try {
    const body = (await request.json()) as { passcode?: string };
    passcode = body.passcode ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  if (!isValidPasscode(passcode)) {
    return NextResponse.json(
      { ok: false, error: "That passcode isn't right." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, sessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Marked `Secure` whenever the request arrived over HTTPS, which is not the
    // same question as whether this is a production build. See the note in
    // `lib/admin/auth.ts`.
    secure: shouldUseSecureCookie(request),
    maxAge: 60 * 60 * 8, // One shift.
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STAFF_COOKIE);
  return response;
}
