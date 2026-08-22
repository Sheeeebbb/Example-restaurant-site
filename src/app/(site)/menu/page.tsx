import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { CategoryFilter } from "@/components/menu/CategoryFilter";
import { getCategories, getMenuItems } from "@/lib/data/repository";
import { resolvePhoto } from "@/lib/data/photos";
import { ServiceStatus } from "@/components/layout/ServiceStatus";
import { RESTAURANT } from "@/lib/config/restaurant";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Menu",
  description: `Burgers, sandwiches, salads, sides and drinks at ${RESTAURANT.name}. Order for delivery or pickup.`,
};

/**
 * The full menu.
 *
 * A server component that filters from the `?category=` search param, so each
 * view is its own URL and the whole page is static HTML. The only client code
 * on it is the add-to-cart button on each card.
 */
export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  const params = await searchParams;
  const requested = typeof params.category === "string" ? params.category : null;

  const categories = await getCategories();
  // An unknown ?category= falls back to showing everything rather than an empty
  // page — a stale link should degrade to the full menu, not a dead end.
  const active = categories.some((c) => c.slug === requested) ? requested : null;

  const items = await getMenuItems(active ? { category: active } : {});
  const withPhotos = items.map((item) => ({
    item,
    photoSrc: resolvePhoto(item.image.src),
  }));

  const sections: { category: Category; items: typeof withPhotos }[] = categories
    .filter((category) => !active || category.slug === active)
    .map((category) => ({
      category,
      items: withPhotos.filter(({ item }) => item.categoryId === category.id),
    }))
    .filter((section) => section.items.length > 0);

  const total = items.length;

  return (
    <>
      <Container className="pb-8 pt-12 sm:pt-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Menu
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
          Everything is cooked to order. Tap any dish to choose sizes, extras and
          sauces before adding it.
        </p>
        <ServiceStatus className="mt-5" />
      </Container>

      <CategoryFilter categories={categories} active={active} />

      <Container className="py-10 sm:py-14">
        {/* Announces the result count when the filter changes the page. */}
        <p role="status" className="sr-only">
          Showing {total} {total === 1 ? "dish" : "dishes"}
          {active ? ` in ${sections[0]?.category.name}` : " across the whole menu"}.
        </p>

        {sections.length === 0 ? (
          <div className="rounded-card border border-line bg-surface p-10 text-center">
            <p className="font-display text-xl font-semibold text-ink">
              Nothing here yet
            </p>
            <p className="mt-2 text-ink-muted">
              That part of the menu is empty right now.
            </p>
            <ButtonLink href="/menu" variant="secondary" className="mt-6">
              Show the whole menu
            </ButtonLink>
          </div>
        ) : (
          <div className="space-y-16">
            {/*
              `priorityCutoff` counts across the whole page, not per section.
              Passing `index < 3` inside each section made the first three cards
              of all six categories eager — eighteen of twenty-six photographs
              fetched before the customer scrolled, most of them far below the
              fold. Only the first row actually competes with the largest
              contentful paint.
            */}
            {sections.map(({ category, items: sectionItems }, sectionIndex) => (
              <section key={category.id} aria-labelledby={`cat-${category.slug}`}>
                <div className="max-w-xl">
                  <h2
                    id={`cat-${category.slug}`}
                    className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
                  >
                    {category.name}
                  </h2>
                  <p className="mt-2 text-ink-muted">{category.description}</p>
                </div>

                <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionItems.map(({ item, photoSrc }, index) => (
                    <li key={item.id}>
                      <MenuItemCard
                        item={item}
                        photoSrc={photoSrc}
                        priority={sectionIndex === 0 && index < 3}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
