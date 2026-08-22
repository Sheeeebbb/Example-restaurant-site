import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RESTAURANT } from "@/lib/config/restaurant";
import { openingHoursSummary } from "@/lib/fulfillment/scheduling";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  const hours = openingHoursSummary();

  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          About {RESTAURANT.name}
        </h1>

        <div className="mt-6 space-y-4 text-ink-muted">
          <p className="leading-relaxed">
            We opened on Edgewood Avenue with one oven, six tables and a
            conviction that a neighbourhood restaurant should be somewhere you
            eat on a Tuesday, not just a birthday.
          </p>
          <p className="leading-relaxed">
            Pasta is rolled every morning. Bread is proved for a day and a night.
            The oven runs at 800&deg;F from noon until we close, and almost
            everything on the menu meets it at some point.
          </p>
          <p className="leading-relaxed">
            The wine list is short, mostly natural, and changes when we find
            something better.
          </p>
        </div>

        <h2 className="mt-12 font-display text-xl font-semibold text-ink">
          Opening hours
        </h2>
        <dl className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
          {hours.map(({ day, hours: range }) => (
            <div key={day} className="flex justify-between gap-4 px-5 py-3 text-sm">
              <dt className="text-ink-muted">{day}</dt>
              <dd className={range === "Closed" ? "text-ink-subtle" : "font-medium text-ink"}>
                {range}
              </dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-12 font-display text-xl font-semibold text-ink">Find us</h2>
        <address className="mt-4 text-ink-muted not-italic">
          {RESTAURANT.address.line1}
          <br />
          {RESTAURANT.address.city}, {RESTAURANT.address.state}{" "}
          {RESTAURANT.address.postalCode}
          <br />
          <a
            className="mt-2 inline-block underline-offset-4 hover:text-ink hover:underline"
            href={`tel:${RESTAURANT.contact.phone.replace(/[^0-9+]/g, "")}`}
          >
            {RESTAURANT.contact.phone}
          </a>
        </address>
      </div>
    </Container>
  );
}
