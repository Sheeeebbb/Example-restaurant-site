import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { RESTAURANT } from "@/lib/config/restaurant";
import { currentActor } from "@/lib/staff/authorize";
import { navigationFor } from "@/lib/staff/navigation";

/**
 * The staff shell.
 *
 * Shares the brand's tokens, typefaces and spacing so it feels like the same
 * product — but inverts the top bar and drops the customer navigation and
 * footer entirely. Someone glancing at a screen in a busy kitchen should never
 * have to wonder which side of the app they are on.
 */
/** Nothing here may be cached across staff: the navigation is per-person. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/"> ) {
  /*
   * Resolved once per request, from the session cookie.
   *
   * Null on the sign-in page, which is the one route in here that is reachable
   * signed out — so the header renders without navigation rather than throwing.
   */
  const actor = await currentActor();

  return (
    <>
      <a
        href="#admin-main"
        className="sr-only rounded-control bg-ember text-sm font-medium text-on-ember focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-100 focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <header className="border-b border-poster-fg/10 bg-poster text-poster-fg">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <Link
              href="/admin"
              className="flex min-h-11 items-center gap-2 font-display text-lg font-semibold tracking-tight"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ember text-sm font-bold text-on-ember"
              >
                UT
              </span>
              {RESTAURANT.name}
              <span className="rounded-full border border-poster-fg/25 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-poster-muted">
                Staff
              </span>
            </Link>

            <AdminNav
              links={actor ? navigationFor(actor) : []}
              staffName={actor?.staff.name ?? null}
            />
          </div>
        </div>
      </header>

      {/*
        Standing reminder, narrowed to what is still true.
        
        Authentication is no longer mocked — real accounts, hashed passwords,
        server-side sessions and permissions checked on every request. The
        orders are still simulated and the payments still fake, and that is
        what this now says. A banner that overstates the problem gets ignored
        as readily as one that understates it.
      */}
      <p className="bg-warning-soft px-4 py-2 text-center text-xs text-warning">
        Demonstration data — orders are simulated and no real payments are
        taken. Staff accounts and permissions are real.
      </p>

      <main id="admin-main" className="flex-1 bg-surface-sunken">
        {children}
      </main>
    </>
  );
}
