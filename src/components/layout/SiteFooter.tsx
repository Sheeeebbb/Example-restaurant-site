import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { Container } from "@/components/ui/Container";
import { RESTAURANT, DELIVERY_ZONES } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";

const EXPLORE_LINKS = [
  { href: "/menu", key: "fullMenu" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
  { href: "/order/track", key: "trackOrder" },
];

/*
 * The last line of the footer, where a staff link conventionally lives.
 *
 * The admin area existed with nothing anywhere on the site pointing at it, so
 * the only way in was to already know the address — which reads, from the
 * outside, as sign-in being broken. It is a normal link to a gated page: the
 * proxy still sends anyone without a session to the passcode screen, so
 * listing it gives away no access.
 */
const LEGAL_LINKS = [
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/admin", key: "staffSignIn" },
];

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const locale = (await getLocale()) as Locale;
  /* Weekday names come out in the reader's language; the hours are the same. */
  const hours = openingHoursSummary(locale);
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
            <h2 className="text-sm font-semibold text-ink">{t("openingHours")}</h2>
            <dl className="mt-3 space-y-1 text-sm">
              {hours.map(({ day, hours: range }) => (
                <div key={day} className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{day}</dt>
                  {/* An empty range means shut that day; the word for it is a
                      translation, not something the scheduler should decide. */}
                  <dd className={range === "" ? "text-ink-subtle" : "text-ink"}>
                    {range === "" ? t("closed") : range}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            {/*
              Footer links are 36px tall rather than the height of their text.
              As bare text they were 17px in a 25px rhythm — legible, but a
              target a thumb misses, and below the 24px WCAG 2.5.8 minimum.
              36px is the size the social links above already use, so the
              footer gained a consistent touch target rather than a new one.
            */}
            <h2 className="text-sm font-semibold text-ink">{t("explore")}</h2>
            <ul className="mt-3 text-sm">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-9 items-center text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>

            <h2 className="mt-6 text-sm font-semibold text-ink">{t("weDeliverTo")}</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {DELIVERY_ZONES.map((zone) => (
                <li key={zone.id}>{zone.name}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t("getInTouch")}</h2>
            <ul className="mt-3 text-sm">
              <li>
                <a
                  className="inline-flex min-h-9 items-center text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  href={telHref}
                >
                  {RESTAURANT.contact.phone}
                </a>
              </li>
              <li>
                <a
                  className="inline-flex min-h-9 items-center text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  href={`mailto:${RESTAURANT.contact.email}`}
                >
                  {RESTAURANT.contact.email}
                </a>
              </li>
            </ul>

            <h2 className="mt-6 text-sm font-semibold text-ink">{t("legal")}</h2>
            <ul className="mt-3 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-9 items-center text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {t(link.key)}
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
