import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/cart/CartButton";
import { RESTAURANT } from "@/lib/config/restaurant";

const NAV_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/order/track", label: "Track order" },
];

/**
 * Server component — only the cart button needs interactivity, so only it is a
 * client component and the navigation ships no JavaScript.
 *
 * There is ONE nav element at every breakpoint, reflowed with flex-wrap and
 * `order`, rather than a desktop copy plus a mobile copy. Duplicating it would
 * mean either announcing every destination twice to a screen reader, or hiding
 * one copy with `display:none` and stranding whichever users are on that
 * breakpoint. Below `md` the nav simply wraps onto a second row.
 *
 * With three destinations this beats a hamburger drawer, which would hide the
 * whole menu behind a tap and require a focus trap, an escape handler, and a
 * scroll lock. Revisit if the nav grows past four or five items.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
      <Container>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 md:h-16 md:flex-nowrap md:py-0">
          <Link
            href="/"
            className="order-1 mr-auto font-display text-xl font-semibold tracking-tight text-ink"
          >
            {RESTAURANT.name}
          </Link>

          <nav
            aria-label="Main"
            className="order-3 w-full md:order-2 md:w-auto"
          >
            <ul className="flex items-center gap-1 overflow-x-auto">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="order-2 md:order-3">
            <CartButton />
          </div>
        </div>
      </Container>
    </header>
  );
}
