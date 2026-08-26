import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, looksLikeSessionToken } from "@/lib/admin/auth";

/**
 * Guards the staff area.
 *
 * Next 16 renamed Middleware to Proxy; this is the same mechanism. Every admin
 * page and every admin API route is checked here, in one place, rather than
 * each handler remembering to check for itself — a route that forgets is how
 * admin areas leak.
 *
 * Two things happen here and they are not the same thing:
 *
 *   • Anyone with no plausible session is sent to the sign-in screen (or given
 *     a 401 if they are a fetch, because redirecting one to an HTML page
 *     produces a baffling parse error instead of an error message).
 *   • Nothing else. Whether a signed-in person may do the thing they are asking
 *     for is decided per action, by `requirePermission`, against permissions
 *     resolved from the store — see `lib/staff/authorize.ts`.
 */
/**
 * The two routes that must stay open, or there would be no way to obtain a
 * session: the sign-in screen itself, and the endpoint it posts to.
 */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/session"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  /*
   * A shape check, and deliberately nothing more.
   *
   * Proxy runs before the application and outside its memory, so it cannot look
   * a token up, resolve an account or read a permission — and it must not
   * pretend to. All it decides is whether to send someone who is plainly
   * signed out to the sign-in page instead of to a 401 they cannot act on.
   *
   * The real gate is `requirePermission` in every protected handler, which
   * resolves the token to an account and that account to its permissions on
   * every single request. A forged cookie of the right shape gets past this
   * line and then fails there, which is the correct division: this is
   * navigation, that is authorisation.
   */
  if (looksLikeSessionToken(request.cookies.get(STAFF_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 },
    );
  }

  const signIn = new URL("/admin/login", request.url);
  // So the customer lands back where they were trying to go.
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
