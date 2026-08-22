import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/cart/CartButton";
import { ButtonLink } from "@/components/ui/Button";
import { RESTAURANT } from "@/lib/config/restaurant";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Server component — only the cart badge needs interactivity, so the navigation
 * itself ships no JavaScript.
 *
 * There is ONE nav element at every breakpoint, reflowed with flex-wrap and
 * `order`, rather than a desktop copy plus a mobile copy. Duplicating it would
 * mean either announcing every destination twice to a screen reader, or hiding
 * one copy with `display:none` and stranding whichever users are on that
 * breakpoint. Below `lg` the nav wraps onto its own row and scrolls sideways if
 * it needs to.
 *
 * With four destinations this beats a hamburger drawer, which would hide the
 * whole menu behind a tap and require a focus trap, an escape handler, and a
 * scroll lock. Revisit if the nav grows past five or six items.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <Container>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 sm:gap-x-4 lg:h-18 lg:flex-nowrap lg:py-0">
          {/*
            `aria-label` fixes the accessible name to the restaurant's name, so
            the wordmark can drop below 360px — where logo, cart and CTA would
            otherwise overflow onto a third row — without the link ever
            announcing as just "UT".
          */}
          <Link
            href="/"
            aria-label={`${RESTAURANT.name} — home`}
            className="order-1 mr-auto flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink sm:text-[1.375rem]"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ember text-sm font-bold text-on-ember"
            >
              UT
            </span>
            <span aria-hidden="true" className="hidden min-[360px]:inline">
              {RESTAURANT.name}
            </span>
          </Link>

          {/*
            Order values do the responsive work. On mobile the nav is full-width
            so it wraps onto its own row beneath the logo and actions; from `lg`
            it shrinks to content width and slots between them. One DOM node,
            two layouts.
          */}
          <nav
            aria-label="Main"
            className="order-3 w-full lg:order-2 lg:w-auto"
          >
            <ul className="flex items-center gap-0.5 overflow-x-auto">
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

          <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
            <CartButton />
            {/*
              "Order" below `sm`, "Order Now" above. Two nodes rather than one,
              because CSS cannot swap text content — but only ever one is in the
              accessibility tree, since `display:none` removes the other.
              Without this the logo and actions overflow 360px and the sticky
              header spills onto a third row.
            */}
            <ButtonLink href="/menu" size="md" className="px-3 sm:px-4">
              <span className="sm:hidden">Order</span>
              <span className="hidden sm:inline">Order Now</span>
            </ButtonLink>
          </div>
        </div>
      </Container>
    </header>
  );
}
