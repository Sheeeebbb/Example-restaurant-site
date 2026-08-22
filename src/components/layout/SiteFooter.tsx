import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { RESTAURANT, DELIVERY_ZONES } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";

export function SiteFooter() {
  const hours = openingHoursSummary();

  return (
    <footer className="mt-auto border-t border-line bg-surface-sunken">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              {RESTAURANT.name}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{RESTAURANT.tagline}</p>
            <address className="mt-4 text-sm not-italic text-ink-muted">
              {RESTAURANT.address.line1}
              <br />
              {RESTAURANT.address.city}, {RESTAURANT.address.state}{" "}
              {RESTAURANT.address.postalCode}
            </address>
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
            <h2 className="text-sm font-semibold text-ink">We deliver to</h2>
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
                  className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  href={`tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`}
                >
                  {RESTAURANT.contact.phone}
                </a>
              </li>
              <li>
                <a
                  className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  href={`mailto:${RESTAURANT.contact.email}`}
                >
                  {RESTAURANT.contact.email}
                </a>
              </li>
              <li>
                <Link
                  className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  href="/order/track"
                >
                  Track an order
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs text-ink-subtle">
          {RESTAURANT.name} is a fictional restaurant built as a demonstration
          project. Orders are simulated and no payments are processed.
        </p>
      </Container>
    </footer>
  );
}
