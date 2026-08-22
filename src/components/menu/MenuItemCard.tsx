import { FoodImage } from "./FoodImage";
import { AddToCartButton } from "./AddToCartButton";
import { DietaryBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money";
import type { MenuItem } from "@/lib/types";

/**
 * The menu item card, shared by the homepage's featured strip and — from stage 2
 * — the full menu listing. Presentational: it takes a resolved `photoSrc` rather
 * than touching the filesystem itself, so it stays usable from anywhere.
 *
 * Only the dietary tags that change an ordering decision are surfaced. Listing
 * all five on every card turns useful signal into wallpaper, so "vegan",
 * "gluten-free" and "spicy" show and the rest live on the detail page.
 */
const DECISION_TAGS = new Set(["vegan", "gluten-free", "spicy"]);

export function MenuItemCard({
  item,
  photoSrc,
  priority = false,
}: {
  item: MenuItem;
  photoSrc: string | null;
  priority?: boolean;
}) {
  const badges = item.tags.filter((tag) => DECISION_TAGS.has(tag));

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-raised ${
        item.available ? "" : "opacity-75"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        <FoodImage
          src={photoSrc}
          alt={item.image.alt}
          categoryId={item.categoryId}
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {!item.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-ink-inverse">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug text-ink">
            {item.name}
          </h3>
          <p className="shrink-0 font-semibold text-ink">
            {formatMoney(item.basePrice)}
          </p>
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
          {item.description}
        </p>

        {badges.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {badges.map((tag) => (
              <li key={tag}>
                <DietaryBadge tag={tag} />
              </li>
            ))}
          </ul>
        )}

        {/* mt-auto pins the action to the bottom so buttons align across a row
            of cards with different description lengths. */}
        <div className="mt-auto pt-4">
          <AddToCartButton item={item} className="w-full" />
        </div>
      </div>
    </article>
  );
}
