import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, isValidSession } from "@/lib/admin/auth";

/**
 * Guards the staff area.
 *
 * Next 16 renamed Middleware to Proxy; this is the same mechanism. Every admin
 * page and every admin API route is checked here, in one place, rather than
 * each handler remembering to check for itself — a route that forgets is how
 * admin areas leak.
 *
 * The check itself is a mock (see `lib/admin/auth.ts`). What is real is the
 * shape: one matcher, one gate, one function to replace.
 *
 * Pages redirect to the sign-in screen so a person sees something useful; API
 * routes get a 401, because redirecting a fetch to an HTML page produces a
 * baffling parse error instead of an error message.
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

  const authorised = isValidSession(request.cookies.get(STAFF_COOKIE)?.value);
  if (authorised) return NextResponse.next();

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
