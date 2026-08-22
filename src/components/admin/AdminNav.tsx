"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="order-3 flex w-full items-center gap-1 sm:order-2 sm:ml-auto sm:w-auto">
      <nav aria-label="Staff" className="min-w-0 flex-1">
        <ul className="flex items-center gap-1 overflow-x-auto">
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
                  className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-control px-3 text-sm font-medium transition-colors ${
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

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-medium text-poster-muted transition-colors hover:text-poster-fg"
        >
          View site
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex min-h-10 items-center rounded-control border border-poster-fg/25 px-3 text-sm font-medium text-poster-fg transition-colors hover:bg-poster-fg/10"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
