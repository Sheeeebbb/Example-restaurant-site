import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { RESTAURANT } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";
import { attributedPhotos } from "@/lib/data/photography";
import { MENU_ITEMS } from "@/lib/data/menu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("metaTitle"), description: RESTAURANT.description };
}

export default async function AboutPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("about");
  const tf = await getTranslations("footer");
  const tm = await getTranslations("menu");
  const hours = openingHoursSummary(locale);
  /*
   * Most of the food photography is CC0 and carries no obligation. The few
   * share-alike frames must be credited wherever they appear, so they are
   * listed here rather than only on the dish page that renders them.
   */
  const dishName = new Map(MENU_ITEMS.map((item) => [item.slug, item.name]));
  const photoCredits = attributedPhotos();

  return (
    <Container className="py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {t("heading", { restaurant: RESTAURANT.name })}
        </h1>

        <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-muted">
          <p>{t("p1")}</p>
          <p>{t("p2")}</p>
          <p>{t("p3")}</p>
        </div>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <section
          aria-labelledby="hours-heading"
          className="rounded-card border border-line bg-surface p-6 sm:col-span-2 lg:col-span-1"
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
          <a
            className="mt-3 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline"
            href={`tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`}
          >
            {RESTAURANT.contact.phone}
          </a>
        </section>

        <section
          aria-labelledby="allergen-heading"
          className="rounded-card border border-line bg-surface p-6"
        >
          <h2 id="allergen-heading" className="font-display text-xl font-semibold text-ink">
            {tm("allergens")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            {t("allergenBody")}
          </p>
        </section>
      </div>

      {photoCredits.length > 0 && (
        <section
          aria-labelledby="photography-heading"
          className="mt-8 rounded-card border border-line bg-surface p-6"
        >
          <h2 id="photography-heading" className="font-display text-xl font-semibold text-ink">
            {t("photography")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            {t("photographyBody")}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            {photoCredits.map(({ slug, credit }) => (
              <li key={slug}>
                <span className="text-ink">
                  {dishName.get(slug) ?? t("homepage")}
                </span>{" "}
                &mdash;{" "}
                {credit.url ? (
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    {credit.photographer ?? credit.source}
                  </a>
                ) : (
                  (credit.photographer ?? credit.source)
                )}
                , {credit.source} &middot; {credit.licence}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12">
        <ButtonLink href="/menu" size="lg">
          {t("seeMenu")}
        </ButtonLink>
      </div>
    </Container>
  );
}
