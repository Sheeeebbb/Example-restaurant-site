import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { DietaryBadge } from "@/components/ui/Badge";
import { FoodImage } from "@/components/menu/FoodImage";
import { ProductCustomizer } from "@/components/menu/ProductCustomizer";
import { getCategoryById, getMenuItemBySlug } from "@/lib/data/repository";
import { resolvePhoto } from "@/lib/data/photos";
import { photoCredit } from "@/lib/data/photography";
import { formatMoney } from "@/lib/money";

/**
 * Rendered per request, not built ahead.
 *
 * The menu is mutable now — staff can reprice a dish or mark it sold out from
 * the admin area — so a page baked at build time would keep serving the old
 * price until the next deploy. A real deployment with a database would use
 * cache tags and revalidate on write instead of giving up static rendering
 * entirely.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/menu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = await getMenuItemBySlug(slug);
  if (!item) return { title: "Not found" };

  return {
    title: item.name,
    description: item.description,
  };
}

export default async function ProductPage({ params }: PageProps<"/menu/[slug]">) {
  const { slug } = await params;
  const item = await getMenuItemBySlug(slug);

  // A removed dish 404s rather than rendering an empty shell — an unavailable
  // one still renders, because "sold out tonight" is different from "gone".
  if (!item) notFound();

  const category = await getCategoryById(item.categoryId);
  const photoSrc = resolvePhoto(item.image.src);
  // Only set when the photograph's licence obliges us to display a credit —
  // most permissive stock licences do not, and the restaurant's own photography
  // never will. Rendering it unconditionally would clutter every dish.
  const credit = photoSrc ? photoCredit(item.slug) : null;

  return (
    <Container className="py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <li>
            <Link href="/menu" className="underline-offset-4 hover:text-ink hover:underline">
              Menu
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/menu?category=${category.slug}`}
                  className="underline-offset-4 hover:text-ink hover:underline"
                >
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {item.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/*
          Image column — sticks on desktop so the dish stays in view while the
          customiser scrolls. It holds ONLY the image: everything else lives in
          the details column, because on mobile the two columns stack and any
          extra block here would push the name and price below the fold.
        */}
        <div className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface-sunken">
            <FoodImage
              src={photoSrc}
              alt={item.image.alt}
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
            />
            {!item.available && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
                <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-inverse">
                  Sold out
                </span>
              </div>
            )}
          </div>

          {credit && (
            <p className="mt-2 text-xs text-ink-subtle">
              Photograph:{" "}
              {credit.url ? (
                <a
                  href={credit.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-4 hover:text-ink"
                >
                  {credit.photographer ?? credit.source}
                </a>
              ) : (
                (credit.photographer ?? credit.source)
              )}{" "}
              · {credit.licence}
            </p>
          )}

        </div>

        {/* Details + customiser */}
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {item.name}
          </h1>

          <p className="mt-3 text-2xl font-semibold text-ink">
            {formatMoney(item.basePrice)}
          </p>

          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            {item.description}
          </p>

          {item.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <li key={tag}>
                  <DietaryBadge tag={tag} />
                </li>
              ))}
            </ul>
          )}

          {item.allergens.length > 0 && (
            <div className="mt-6 rounded-card border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold text-ink">Allergens</h2>
              <p className="mt-2 text-sm capitalize leading-relaxed text-ink-muted">
                {item.allergens.join(", ")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Prepared in a kitchen that handles all major allergens. Call us
                on anything critical.
              </p>
            </div>
          )}

          {!item.available && (
            <p
              role="status"
              className="mt-6 rounded-control border border-line bg-surface-sunken p-4 text-sm text-ink-muted"
            >
              This dish is sold out for now. Everything else on the menu is still
              available.
            </p>
          )}

          <div className="mt-8 border-t border-line pt-8">
            <ProductCustomizer item={item} />
          </div>
        </div>
      </div>
    </Container>
  );
}
