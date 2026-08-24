import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CartMenu } from "@/components/cart/CartMenu";
import { resolveMenuPhotos } from "@/lib/data/photos";
import { getMenuItems } from "@/lib/data/repository";
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
export async function SiteHeader() {
  /*
   * The cart preview shows a thumbnail per line, and resolving a photograph
   * touches the filesystem — server work. Resolved here and handed down, the
   * same way the cart page does it, so the header's client half never fetches.
   */
  const items = await getMenuItems();
  const categoryByItemId = Object.fromEntries(
    items.map((item) => [item.id, item.categoryId]),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <Container>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 sm:gap-x-4 lg:h-18 lg:flex-nowrap lg:py-0">
          {/*
            `aria-label` fixes the accessible name to the restaurant's name, so
            the wordmark can drop below 360px, where the logo and cart would
            otherwise crowd each other, without the link ever announcing as
            just "UT".
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

          {/*
            The cart is the only action here. An "Order Now" button used to sit
            beside it, but it went to /menu — the same place as the Menu link two
            inches to its left — so it dressed a navigation item up as a call to
            action and took the header to three rows at 360px for nothing.
            Ordering starts from the menu, and the menu has its own nav item.

            On a pointer device the cart also previews its contents on hover;
            see `CartMenu`. On touch it stays a plain link to the cart page.
          */}
          <div className="order-2 flex shrink-0 items-center gap-2 lg:order-3">
            <CartMenu
              photoMap={resolveMenuPhotos(items)}
              categoryByItemId={categoryByItemId}
            />
          </div>
        </div>
      </Container>
    </header>
  );
}
