"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * The staff navigation.
 *
 * The links are handed in, already filtered to what this person's roles allow —
 * see `lib/staff/navigation.ts`. This component chooses none of them, so there
 * is no list of destinations in the client bundle to read off and no hidden
 * link to un-hide. Every destination checks again on the server anyway.
 */
export function AdminNav({
  links,
  staffName,
}: {
  links: { href: string; label: string }[];
  staffName: string | null;
}) {
  const LINKS = [{ href: "/admin", label: "Dashboard" }, ...links];
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  };

  /*
   * The nav wraps instead of scrolling. It used to be `flex-1 overflow-x-auto`
   * next to a shrink-0 action group, which squeezed it below its content width
   * and clipped "Menu" mid-word at 768px and under — a navigation item you
   * cannot see is a navigation item you do not have.
   */
  return (
    <div className="order-3 flex w-full flex-wrap items-center gap-x-2 gap-y-1 sm:order-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
      <nav aria-label="Staff">
        <ul className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => {
            // `/admin` would otherwise light up on every child route.
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-poster-fg/12 text-poster-fg"
                      : "text-poster-muted hover:bg-poster-fg/8 hover:text-poster-fg"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
        {staffName && (
          <span className="hidden px-2 text-sm text-poster-muted sm:inline">
            {staffName}
          </span>
        )}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-poster-muted transition-colors hover:text-poster-fg"
        >
          View site
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex min-h-11 items-center rounded-control border border-poster-fg/25 px-3 text-sm font-medium text-poster-fg transition-colors hover:bg-poster-fg/10"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
