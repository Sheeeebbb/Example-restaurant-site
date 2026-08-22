import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RESTAURANT, DELIVERY_ZONES } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";

export const metadata: Metadata = {
  title: "Contact",
  description: `Find ${RESTAURANT.name} in ${RESTAURANT.address.city} — address, opening hours, phone and delivery area.`,
};

/**
 * Contact details, presented as real information rather than a form.
 *
 * A contact form needs somewhere to send the message, and there is no mail
 * transport wired up yet — so this page gives the phone number and email address
 * that actually reach the restaurant instead of a form that silently discards
 * what people type. The form arrives with the backend.
 */
export default function ContactPage() {
  const hours = openingHoursSummary();
  const telHref = `tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`;

  return (
    <Container className="py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Contact
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          Questions about an order, an allergy, or a large booking? The fastest
          way to reach us is the phone — someone on the floor will pick up.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="reach-heading"
          className="rounded-card border border-line bg-surface p-6"
        >
          <h2 id="reach-heading" className="font-display text-xl font-semibold text-ink">
            Reach us
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-ink-subtle">Phone</dt>
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
              <dt className="text-ink-subtle">Email</dt>
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
              <dt className="text-ink-subtle">Social</dt>
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
            Find us
          </h2>
          <address className="mt-4 text-sm not-italic leading-relaxed text-ink-muted">
            {RESTAURANT.address.line1}
            <br />
            {RESTAURANT.address.postalCode} {RESTAURANT.address.city}
          </address>

          <h3 className="mt-6 text-sm font-semibold text-ink">Delivery area</h3>
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
      </div>
    </Container>
  );
}
