import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * The cart with nothing in it.
 *
 * Written as a destination rather than an absence: a heading, a sentence that
 * says what to do next, and one obvious action. An empty cart is a normal
 * moment in an order — most people arrive here before they have chosen
 * anything — so it should look like a page someone designed, not like content
 * that failed to load.
 *
 * The mark is a covered serving dish rather than an empty box or a shopping
 * trolley: this is a restaurant, and the answer to an empty cart is food.
 * Drawn in the same thin line-art as the category glyphs so it belongs to the
 * same family.
 *
 * The entrance is the hero's `fade-up`, behind `motion-safe:` like every other
 * animation here, so it never plays for anyone who asked for less motion.
 */
export function EmptyCart() {
  const t = useTranslations("cart");
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto flex max-w-md flex-col items-center text-center motion-safe:animate-[fade-up_320ms_ease-out]">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-ember-soft text-ember"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10"
          >
            {/* Cloche: dome, rim, handle — and the plate it sits on. */}
            <path d="M5 20a11 11 0 0 1 22 0" />
            <path d="M3 20h26" />
            <path d="M16 9V6.5" />
            <circle cx="16" cy="5" r="1.4" />
            <path d="M7 24h18" />
          </svg>
        </span>

        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t("empty")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {t("emptyLead")}
        </p>

        <ButtonLink href="/menu" size="lg" className="mt-8">
          {t("exploreMenu")}
        </ButtonLink>
      </div>
    </Container>
  );
}
