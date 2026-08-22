import { Container } from "@/components/ui/Container";
import { SectionHeading } from "./SectionHeading";

/**
 * Illustrative reviews for a fictional restaurant.
 *
 * Kept in one place and clearly captioned in the footer as part of a
 * demonstration project. When real reviews arrive they come from whatever
 * platform collects them, not from this file.
 */
const TESTIMONIALS = [
  {
    quote:
      "Ordered for six people on a Friday night expecting chaos. Everything arrived hot, correctly labelled, and the fries were somehow still crisp. That never happens.",
    name: "Marta K.",
    context: "Kreuzberg · Delivery",
  },
  {
    quote:
      "I use the pickup option most weeks on my way home. It's ready when the app says it will be, every time, and nobody makes me queue behind the dine-in crowd.",
    name: "Jonas R.",
    context: "Neukölln · Pickup",
  },
  {
    quote:
      "The allergen info on every dish is the reason we keep coming back. My daughter is coeliac and this is one of the few places we order from without phoning ahead.",
    name: "Priya S.",
    context: "Prenzlauer Berg · Delivery",
  },
];

function Stars() {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 20 20" className="h-4 w-4 fill-ember">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
        </svg>
      ))}
    </span>
  );
}

export function Testimonials() {
  return (
    <section aria-labelledby="testimonials-heading" className="bg-paper">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          id="testimonials-heading"
          eyebrow="Reviews"
          title="What the neighbourhood says"
          align="center"
        />

        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <li key={testimonial.name}>
              <figure className="flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-card">
                <Stars />
                <span className="sr-only">Rated 5 out of 5</span>
                <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-relaxed text-ink-muted">
                  <p>&ldquo;{testimonial.quote}&rdquo;</p>
                </blockquote>
                <figcaption className="mt-5 border-t border-line pt-4">
                  <span className="block font-semibold text-ink">
                    {testimonial.name}
                  </span>
                  <span className="text-sm text-ink-subtle">
                    {testimonial.context}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
