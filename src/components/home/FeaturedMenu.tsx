import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { SectionHeading } from "./SectionHeading";
import type { MenuItem } from "@/lib/types";

export function FeaturedMenu({
  items,
}: {
  items: { item: MenuItem; photoSrc: string | null }[];
}) {
  return (
    <section aria-labelledby="featured-heading" className="bg-paper">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          id="featured-heading"
          eyebrow="Most popular"
          title="Straight off the pass"
          description="The dishes our regulars order again and again."
          action={
            <ButtonLink href="/menu" variant="secondary">
              View full menu
            </ButtonLink>
          }
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
      </Container>
    </section>
  );
}
