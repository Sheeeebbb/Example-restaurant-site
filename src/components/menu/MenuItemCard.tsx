import Link from "next/link";
import { FoodImage } from "./FoodImage";
import { AddToCartButton } from "./AddToCartButton";
import { DietaryBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money";
import { canQuickAdd } from "@/lib/cart/lines";
import type { MenuItem } from "@/lib/types";

/**
 * The menu item card, shared by the homepage's featured strip and the menu page.
 * Presentational: it takes a resolved `photoSrc` rather than touching the
 * filesystem itself, so it stays usable from anywhere.
 *
 * Two actions sit side by side rather than one covering the whole card: the
 * image and title open the product for customising, and the button adds the
 * standard build in one tap. A card-wide click target would have swallowed the
 * button, and nesting a button inside a link is invalid anyway.
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
  const href = `/menu/${item.slug}`;
  // When an item can't be added in one tap, AddToCartButton already renders a
  // "Choose options" link to this same page — a second "Customise" beside it
  // would be two buttons pointing at one destination.
  const showCustomise =
    item.optionGroups.length > 0 && item.available && canQuickAdd(item);

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-raised ${
        item.available ? "" : "opacity-75"
      }`}
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[4/3] overflow-hidden bg-surface-sunken"
      >
        {/*
          The frame is `aria-hidden` because the dish name beside it links to
          the same place, so alt text here would announce the destination twice.
          The meaningful description lives on `item.image.alt` and is announced
          on the product page, where the photograph is the content rather than a
          thumbnail beside its own label.
        */}
        <FoodImage
          src={photoSrc}
          alt=""
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
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug">
            {/*
              The image above repeats this destination, so it is hidden from
              assistive tech and removed from the tab order — one stop per card
              rather than two identical ones.
            */}
            <Link
              href={href}
              className="text-ink underline-offset-4 hover:underline"
            >
              {item.name}
            </Link>
          </h3>
          <p className="shrink-0 font-semibold tabular-nums text-ink">
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

        {/* mt-auto pins the actions to the bottom so buttons align across a row
            of cards with different description lengths. */}
        <div className="mt-auto flex items-center gap-2 pt-4">
          <AddToCartButton item={item} className="flex-1" />

          {showCustomise && (
            <Link
              href={href}
              className="inline-flex min-h-9 shrink-0 items-center rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              Customise
              <span className="sr-only"> {item.name}</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
