import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { RESTAURANT } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";
import { attributedPhotos } from "@/lib/data/photography";
import { MENU_ITEMS } from "@/lib/data/menu";

export const metadata: Metadata = {
  title: "About",
  description: RESTAURANT.description,
};

export default function AboutPage() {
  const hours = openingHoursSummary();
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
          About {RESTAURANT.name}
        </h1>

        <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-muted">
          <p>
            We opened on Oranienstraße with a flat top, a walk-in full of
            vegetables, and one rule: cook everything to order, properly, and
            charge a fair price for it.
          </p>
          <p>
            Beef is ground fresh each morning and smashed to order. Bread is
            baked in-house. Salads are dressed when you order them, not hours
            before. Nothing sits under a heat lamp waiting for a courier.
          </p>
          <p>
            Most of what we serve travels well, which is deliberate — a burger
            that falls apart on the way to you is a burger we got wrong.
          </p>
        </div>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <section
          aria-labelledby="hours-heading"
          className="rounded-card border border-line bg-surface p-6 sm:col-span-2 lg:col-span-1"
        >
          <h2 id="hours-heading" className="font-display text-xl font-semibold text-ink">
            Opening hours
          </h2>
          <dl className="mt-4 space-y-1 text-sm">
            {hours.map(({ day, hours: range }) => (
              <div key={day} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{day}</dt>
                <dd className={range === "Closed" ? "text-ink-subtle" : "font-medium text-ink"}>
                  {range}
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
            Find us
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
            Allergens
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Every dish lists its allergens on the menu. If you need something
            adapted, call us before ordering and we&rsquo;ll tell you honestly
            whether we can do it safely.
          </p>
        </section>
      </div>

      {photoCredits.length > 0 && (
        <section
          aria-labelledby="photography-heading"
          className="mt-8 rounded-card border border-line bg-surface p-6"
        >
          <h2 id="photography-heading" className="font-display text-xl font-semibold text-ink">
            Photography
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Our own photography is on its way. Until then some dishes are shown
            with licensed stock photographs, and these ones ask to be credited:
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            {photoCredits.map(({ slug, credit }) => (
              <li key={slug}>
                <span className="text-ink">
                  {dishName.get(slug) ?? "Homepage"}
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
          See the menu
        </ButtonLink>
      </div>
    </Container>
  );
}
