import { Hero } from "@/components/home/Hero";
import { FeaturedMenu } from "@/components/home/FeaturedMenu";
import { PromoBanner } from "@/components/home/PromoBanner";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { Testimonials } from "@/components/home/Testimonials";
import { getMenuItems } from "@/lib/data/repository";
import { resolvePhoto } from "@/lib/data/photos";
import { HERO_BRIEF } from "@/lib/data/photography";

/**
 * Homepage.
 *
 * A server component: it reads the menu through the repository seam and
 * resolves photography on the server, so cards arrive fully formed with no
 * client-side data fetching and no layout shift. Only the three genuinely
 * interactive pieces — the cart badge, the order-mode buttons, and add-to-cart —
 * are client components.
 */
export default async function HomePage() {
  const featured = await getMenuItems({ featuredOnly: true, availableOnly: true });

  const cards = featured.slice(0, 6).map((item) => ({
    item,
    photoSrc: resolvePhoto(item.image.src),
  }));

  const showcase = cards[0]?.item ?? null;

  return (
    <>
      <Hero
        showcase={showcase}
        showcasePhoto={showcase ? resolvePhoto(showcase.image.src) : null}
        heroPhoto={resolvePhoto(`/menu/${HERO_BRIEF.file}`)}
      />
      <FeaturedMenu items={cards} />
      <PromoBanner />
      <WhyChooseUs />
      <Testimonials />
    </>
  );
}
