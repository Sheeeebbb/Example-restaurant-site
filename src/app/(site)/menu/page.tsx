import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { CategoryNav, type NavSection } from "@/components/menu/CategoryNav";
import { getCategories, getMenuItems } from "@/lib/data/repository";
import { resolvePhoto } from "@/lib/data/photos";
import { ServiceStatus } from "@/components/layout/ServiceStatus";
import { RESTAURANT } from "@/lib/config/restaurant";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("menu");
  return {
    title: t("title"),
    description: `${t("lead")} ${RESTAURANT.name}.`,
  };
}

/**
 * Rendered per request for the same reason as the product page: staff can
 * reprice a dish or mark it sold out from the admin area, and a menu baked at
 * build time would keep serving yesterday's.
 */
export const dynamic = "force-dynamic";

/**
 * The full menu — every category on one page.
 *
 * It used to filter: choosing "Burgers" reloaded `/menu?category=burgers` with
 * the other five categories removed. That is a database view, not a menu.
 * People read a menu by scrolling it, and a customer who came for a burger will
 * happily add a side they saw on the way past. So the page now renders
 * everything and the category bar scrolls to a heading instead of hiding its
 * neighbours.
 *
 * "Popular" leads, built from the `featured` flag the homepage strip already
 * uses — the same items, listed twice on one page, not a second copy of the
 * data.
 */
export default async function MenuPage() {
  const th = await getTranslations("menu");
  const categories = await getCategories();
  const items = await getMenuItems();

  const withPhotos = items.map((item) => ({
    item,
    photoSrc: resolvePhoto(item.image.src),
  }));

  const popular = withPhotos.filter(({ item }) => item.featured);

  const sections = [
    ...(popular.length > 0
      ? [
          {
            id: "cat-popular",
            name: "Popular",
            description: th("popularBody"),
            items: popular,
          },
        ]
      : []),
    ...categories
      .map((category) => ({
        id: `cat-${category.slug}`,
        name: category.name,
        description: category.description,
        items: withPhotos.filter(({ item }) => item.categoryId === category.id),
      }))
      .filter((section) => section.items.length > 0),
  ];

  const navSections: NavSection[] = sections.map(({ id, name }) => ({ id, name }));

  return (
    <>
      <Container className="pb-8 pt-12 sm:pt-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {th("title")}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
          {th("leadLong")}
        </p>
        <ServiceStatus className="mt-5" />
      </Container>

      <CategoryNav sections={navSections} />

      <Container className="py-10 sm:py-14">
        {sections.length === 0 ? (
          <div className="rounded-card border border-line bg-surface p-10 text-center">
            <p className="font-display text-xl font-semibold text-ink">
              The menu is empty
            </p>
            <p className="mt-2 text-ink-muted">
              Nothing is listed right now. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {/*
              `priority` counts across the whole page, not per section. Passing
              `index < 3` inside each section made the first three cards of all
              six categories eager — eighteen of twenty-six photographs fetched
              before the customer scrolled, most of them far below the fold.
              Only the first row actually competes with the largest contentful
              paint.
            */}
            {sections.map((section, sectionIndex) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                /* Lands the heading below the header and the category bar
                   rather than underneath them, for hash links and for the
                   smooth scroll the bar performs. */
                className="scroll-mt-[calc(var(--header-height)+var(--menu-nav-height))]"
              >
                <div className="max-w-xl">
                  <h2
                    id={`${section.id}-heading`}
                    className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
                  >
                    {section.name}
                  </h2>
                  <p className="mt-2 text-ink-muted">{section.description}</p>
                </div>

                <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map(({ item, photoSrc }, index) => (
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

        {/*
          The last category is shorter than the band the observer watches, so
          scrolling to the very bottom would otherwise leave the previous chip
          lit. This marks the end of the menu for it.
        */}
        <div id="menu-end" aria-hidden="true" className="h-px" />
      </Container>
    </>
  );
}
