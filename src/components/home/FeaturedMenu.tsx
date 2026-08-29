import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { SectionHeading } from "./SectionHeading";
import type { MenuItem } from "@/lib/types";

/**
 * The homepage's popular-dishes strip, ending in the route to everything else.
 *
 * That call to action used to be a small outlined button tucked beside the
 * heading, level with the title and read before the customer had seen a single
 * dish — so it competed with the heading for attention and lost. It now sits
 * where the question it answers actually arises: after six dishes, when someone
 * is either sold or wondering what else there is. Given the whole width, a line
 * of context and the page's primary colour, it reads as the obvious next step
 * rather than a footnote.
 */
export async function FeaturedMenu({
  items,
}: {
  items: { item: MenuItem; photoSrc: string | null }[];
}) {
  const t = await getTranslations("home");
  return (
    <section aria-labelledby="featured-heading" className="bg-paper">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          id="featured-heading"
          eyebrow={t("mostPopular")}
          title={t("straightOffThePass")}
          description={t("popularBody")}
        />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ item, photoSrc }, index) => (
            <li key={item.id}>
              <MenuItemCard
                item={item}
                photoSrc={photoSrc}
                priority={index < 3}
              />
            </li>
          ))}
        </ul>

        {/*
          The rule and the generous top margin separate this from the grid, so
          it reads as "and now, everything else" rather than as a seventh card.
        */}
        <div className="mt-12 border-t border-line pt-10 text-center">
          <p className="mx-auto max-w-md text-lg leading-relaxed text-ink-muted">
            That&rsquo;s a handful of our regulars&rsquo; favourites. Burgers,
            sandwiches, salads, sides, desserts and drinks are all on the full
            menu.
          </p>

          <ButtonLink
            href="/menu"
            size="lg"
            className="group mt-6 w-full justify-center text-base font-semibold shadow-card transition-shadow hover:shadow-raised sm:w-auto sm:px-8"
          >
            {t("viewFullMenu")}
            {/* Nudges forward on hover — a hint of direction, not an animation. */}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 transition-transform duration-200 motion-safe:group-hover:translate-x-1"
            >
              <path d="M3 10h13M11 5l5 5-5 5" />
            </svg>
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
