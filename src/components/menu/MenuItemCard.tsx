"use client";

import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { FoodImage } from "./FoodImage";
import { ProductDialog } from "./ProductDialog";
import { DietaryBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money";
import type { MenuItem } from "@/lib/types";

/**
 * The menu item card, shared by the homepage's featured strip and the menu page.
 * Presentational: it takes a resolved `photoSrc` rather than touching the
 * filesystem itself, so it stays usable from anywhere.
 *
 * The whole card is one control that opens the product panel. Nothing can be
 * added straight from the grid any more — a customer sees the description,
 * allergens and options before committing, which is the point. That also
 * removed a real inconsistency: a dish with a required choice and no sensible
 * default (Spring Water: still or sparkling) used to render t("chooseOptions")
 * where every other card said t("addToCart"), because a one-tap add could not
 * honestly be offered. With one interaction for every dish, the special case
 * has nothing left to be special about.
 *
 * It is still a real `<a href>` to the product page, stretched across the card
 * with a pseudo-element. So: one tab stop, the whole card clickable, a URL in
 * the status bar, cmd-click opens the page in a new tab, and with JavaScript
 * still loading the link simply navigates instead of doing nothing.
 *
 * Only the dietary tags that change an ordering decision are surfaced. Listing
 * all five on every card turns useful signal into wallpaper, so "vegan",
 * "gluten-free" and "spicy" show and the rest live in the product panel.
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
  const t = useTranslations("menu");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(false);
  const badges = item.tags.filter((tag) => DECISION_TAGS.has(tag));
  const href = `/menu/${item.slug}`;

  /*
   * Put focus back on the card the panel came from. A native <dialog> restores
   * focus itself when it closes, but React removes the element as part of the
   * same update, so the restore lands nowhere and a keyboard user is returned
   * to the top of the document — twenty cards away from where they were.
   */
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    // Leave the modified clicks alone: cmd/ctrl/shift and middle-click are how
    // people open things in new tabs, and hijacking them is how sites feel
    // broken.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <article
        /*
          `active:` on the ARTICLE, not on the link: the whole card is the tap
          target, so the whole card is what should answer a press. A transform
          here is safe — the article is already `relative`, so it was the
          stretched link's containing block before and still is.
        */
        className={`group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[transform,box-shadow] duration-200 focus-within:-translate-y-1 focus-within:shadow-raised hover:-translate-y-1 hover:shadow-raised active:scale-[0.985] active:shadow-card ${
          item.available ? "" : "opacity-75"
        }`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
          {/*
            The photograph is decorative here: the dish name sits directly
            beneath it and names the same thing. Its real description is
            announced in the product panel, where the photograph is the content
            rather than a thumbnail beside its own label.
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
                {t("soldOut")}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-semibold leading-snug">
              <Link
                ref={triggerRef}
                href={href}
                onClick={handleOpen}
                aria-haspopup="dialog"
                /* `after:` stretches this link over the whole card — one control,
                   one tab stop, the entire tile clickable. */
                /* The card carries the pressed state; the title opting out of
                   the global link fade keeps the two from doubling up. */
                className="text-ink underline-offset-4 after:absolute after:inset-0 after:content-[''] active:opacity-100 group-hover:underline"
              >
                {item.name}
              </Link>
            </h3>
            <p className="shrink-0 font-semibold tabular-nums text-ink">
              {formatMoney(item.basePrice, locale)}
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

          {/*
            mt-auto keeps this line on the bottom edge so it aligns across a row
            of cards with different description lengths. It replaces the old
            button row: the card no longer acts, it opens.
          */}
          <p className="mt-auto pt-4 text-sm font-medium text-ember">
            {item.available
              ? item.optionGroups.length > 0
                ? t("chooseOptions")
                : t("viewDish")
              : t("unavailable")}
          </p>
        </div>
      </article>

      {open && (
        <ProductDialog
          item={item}
          photoSrc={photoSrc}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
