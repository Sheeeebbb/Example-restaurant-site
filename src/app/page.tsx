import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getMenuItems } from "@/lib/data/repository";
import { formatMoney } from "@/lib/money";
import { RESTAURANT } from "@/lib/config/restaurant";
import { isAcceptingOrdersAt } from "@/lib/fulfillment/scheduling";

/**
 * Landing page.
 *
 * A server component that reads through the repository seam — the same call
 * shape it will use once the menu comes from a database. Nothing here talks to
 * the seed module directly.
 */
export default async function HomePage() {
  const featured = await getMenuItems({ featuredOnly: true, availableOnly: true });
  const openNow = isAcceptingOrdersAt(new Date());

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-24">
          <div className="max-w-2xl">
            <Badge tone={openNow ? "herb" : "neutral"}>
              {openNow ? "Open now — ordering online" : "Closed — schedule an order"}
            </Badge>

            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Wood-fired plates,
              <br />
              natural wine, no fuss.
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-ink-muted">
              A neighbourhood kitchen in the Old Fourth Ward. Order ahead for
              pickup, or let us bring it to you — free delivery over{" "}
              {formatMoney(RESTAURANT.fees.freeDeliveryThreshold)}.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/menu" size="lg">
                Browse the menu
              </ButtonLink>
              <ButtonLink href="/about" size="lg" variant="secondary">
                About us
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Featured ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="featured-heading">
        <Container className="py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="featured-heading"
                className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
              >
                What we&rsquo;re known for
              </h2>
              <p className="mt-2 text-ink-muted">
                A few things the kitchen would be sad to see you skip.
              </p>
            </div>
          </div>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
              >
                {/*
                  Photography drops into /public/menu/ in stage 2. Until then a
                  warm gradient stands in — decorative, so it is hidden from
                  assistive tech rather than given a meaningless alt text.
                */}
                <div
                  aria-hidden="true"
                  className="h-36 bg-gradient-to-br from-ember-soft via-surface-sunken to-ember-border"
                />
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {item.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                    {item.description}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-ink">
                    {formatMoney(item.basePrice)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section aria-labelledby="how-heading" className="border-t border-line bg-surface">
        <Container className="py-16">
          <h2
            id="how-heading"
            className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
          >
            Pickup or delivery
          </h2>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-card border border-line bg-paper p-6">
              <h3 className="font-display text-lg font-semibold text-ink">Pickup</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Ready in about {RESTAURANT.ordering.minimumPrepMinutes} minutes.
                Collect from the pass at {RESTAURANT.address.line1}. No fee, and
                you can schedule up to {RESTAURANT.ordering.maxDaysAhead} days
                ahead.
              </p>
            </div>

            <div className="rounded-card border border-line bg-paper p-6">
              <h3 className="font-display text-lg font-semibold text-ink">Delivery</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                We deliver across Downtown, Inman Park, Midtown and Decatur.
                Fees and minimum orders vary by neighbourhood, and delivery is
                free over {formatMoney(RESTAURANT.fees.freeDeliveryThreshold)}.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
