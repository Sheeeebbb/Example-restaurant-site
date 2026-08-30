import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RESTAURANT, DELIVERY_ZONES } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription", {
      restaurant: RESTAURANT.name,
      city: RESTAURANT.address.city,
    }),
  };
}

/**
 * Contact details, presented as real information rather than a form.
 *
 * A contact form needs somewhere to send the message, and there is no mail
 * transport wired up yet — so this page gives the phone number and email address
 * that actually reach the restaurant instead of a form that silently discards
 * what people type. The form arrives with the backend.
 */
export default async function ContactPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("contact");
  const tf = await getTranslations("footer");
  const tc = await getTranslations("checkout");
  const hours = openingHoursSummary(locale);
  const telHref = `tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`;

  return (
    <Container className="py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {t("heading")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {t("lead")}
        </p>
      </div>

      {/*
        `[&>*]:min-w-0` for the third time in this project, and for the same
        reason each time: a grid item will not shrink below the intrinsic width
        of its content, and this column holds an email address that cannot be
        broken. Without it a large system font size pushes the page wider than
        the screen. See the cart and checkout grids.
      */}
      <div className="mt-12 grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <section
          aria-labelledby="reach-heading"
          className="rounded-card border border-line bg-surface p-6"
        >
          <h2 id="reach-heading" className="font-display text-xl font-semibold text-ink">
            {t("reachUs")}
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-ink-subtle">{tc("phone")}</dt>
              <dd className="mt-1">
                <a
                  href={telHref}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {RESTAURANT.contact.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">{t("email")}</dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${RESTAURANT.contact.email}`}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {RESTAURANT.contact.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">{t("social")}</dt>
              <dd className="mt-1 flex flex-wrap gap-3">
                {RESTAURANT.social.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {social.label}
                  </a>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="find-heading"
          className="rounded-card border border-line bg-surface p-6"
        >
          <h2 id="find-heading" className="font-display text-xl font-semibold text-ink">
            {t("findUs")}
          </h2>
          <address className="mt-4 text-sm not-italic leading-relaxed text-ink-muted">
            {RESTAURANT.address.line1}
            <br />
            {RESTAURANT.address.postalCode} {RESTAURANT.address.city}
          </address>

          <h3 className="mt-6 text-sm font-semibold text-ink">{t("deliveryArea")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {DELIVERY_ZONES.map((zone) => (
              <li key={zone.id}>{zone.name}</li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="hours-heading"
          className="rounded-card border border-line bg-surface p-6"
        >
          <h2 id="hours-heading" className="font-display text-xl font-semibold text-ink">
            {tf("openingHours")}
          </h2>
          <dl className="mt-4 space-y-1 text-sm">
            {hours.map(({ day, hours: range, closed }) => (
              <div key={day} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{day}</dt>
                <dd className={closed ? "text-ink-subtle" : "font-medium text-ink"}>
                  {closed ? tf("closed") : range}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Container>
  );
}
