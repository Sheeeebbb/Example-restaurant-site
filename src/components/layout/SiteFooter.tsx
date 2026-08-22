import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { RESTAURANT, DELIVERY_ZONES } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";

const EXPLORE_LINKS = [
  { href: "/menu", label: "Full menu" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
  { href: "/order/track", label: "Track an order" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  const hours = openingHoursSummary();
  const telHref = `tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`;

  return (
    <footer className="mt-auto border-t border-line bg-surface-sunken">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ember text-sm font-bold text-on-ember"
              >
                UT
              </span>
              {RESTAURANT.name}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {RESTAURANT.tagline} A modern neighbourhood restaurant in{" "}
              {RESTAURANT.address.city}.
            </p>

            <address className="mt-4 text-sm not-italic leading-relaxed text-ink-muted">
              {RESTAURANT.address.line1}
              <br />
              {RESTAURANT.address.postalCode} {RESTAURANT.address.city}
            </address>

            <ul className="mt-4 flex flex-wrap gap-2">
              {RESTAURANT.social.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-9 items-center rounded-control border border-line-strong bg-surface px-3 text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Opening hours</h2>
            <dl className="mt-3 space-y-1 text-sm">
              {hours.map(({ day, hours: range }) => (
                <div key={day} className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{day}</dt>
                  <dd className={range === "Closed" ? "text-ink-subtle" : "text-ink"}>
                    {range}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Explore</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h2 className="mt-6 text-sm font-semibold text-ink">We deliver to</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {DELIVERY_ZONES.map((zone) => (
                <li key={zone.id}>{zone.name}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Get in touch</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  href={telHref}
                >
                  {RESTAURANT.contact.phone}
                </a>
              </li>
              <li>
                <a
                  className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  href={`mailto:${RESTAURANT.contact.email}`}
                >
                  {RESTAURANT.contact.email}
                </a>
              </li>
            </ul>

            <h2 className="mt-6 text-sm font-semibold text-ink">Legal</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-subtle">
            &copy; {new Date().getFullYear()} {RESTAURANT.name}.
          </p>
          <p className="text-xs text-ink-subtle">
            A fictional restaurant built as a demonstration project. Orders are
            simulated, reviews are illustrative, and no payments are processed.
          </p>
        </div>
      </Container>
    </footer>
  );
}
