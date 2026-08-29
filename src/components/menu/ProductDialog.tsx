"use client";

import { useTranslations } from "next-intl";

import { useEffect, useRef, useState } from "react";
import { FoodImage } from "./FoodImage";
import { ProductCustomizer } from "./ProductCustomizer";
import { DietaryBadge } from "@/components/ui/Badge";
import { photoCredit } from "@/lib/data/photography";
import { formatMoney } from "@/lib/money";
import type { MenuItem } from "@/lib/types";

/**
 * The product panel — one interaction for every dish on the menu.
 *
 * Tapping a card opens this rather than navigating, so a customer can read a
 * dish, configure it, add it, and carry on scrolling from exactly where they
 * were. The product page at `/menu/[slug]` still exists for deep links and
 * search engines; both render the same `ProductCustomizer`, so pricing,
 * validation and cart writes have one implementation, not two.
 *
 * Built on the native `<dialog>` element. `showModal()` supplies the focus
 * trap, the Escape key, inertness of the page behind it and top-layer
 * stacking — all things a hand-rolled div would have to reimplement, usually
 * incompletely.
 *
 * A dish with no options is not given an empty customiser: `ProductCustomizer`
 * renders only what the item actually has, so water gets its information, a
 * quantity and an add button, while a burger gets six groups of choices.
 */
export function ProductDialog({
  item,
  photoSrc,
  onClose,
}: {
  item: MenuItem;
  photoSrc: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("menu");
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Handed to the customiser so it can render its add button into the footer
  // below, which stays put while the body scrolls.
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const credit = photoSrc ? photoCredit(item.slug) : null;
  const headingId = `product-dialog-${item.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) dialog.showModal();

    /*
     * `showModal()` blocks interaction with the page but not scrolling of it,
     * so the menu would still slide about behind the panel. The padding
     * compensates for the scrollbar the lock removes, which otherwise shifts
     * the whole layout sideways as the panel opens.
     */
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      /*
       * Escape is handled through `cancel`, not `close`. The `close` event
       * fires for *any* close, including the one in the cleanup above — and in
       * development React mounts effects twice, so a `close` handler would tear
       * the panel down the instant it opened. `cancel` fires only for the
       * user's Escape, which is the only native path we actually want to react
       * to.
       */
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      /*
       * `overflow-hidden` on the dialog itself, not only on the body.
       *
       * Locking the body stops the page behind from moving; this stops the
       * dialog from becoming a second scroll container. Without it the panel
       * can be carried off the top of the screen when the viewport shrinks —
       * which on Android happens every time the URL bar slides away, changing
       * what `dvh` means mid-gesture. The only thing that scrolls in here is
       * the body below, and that is now true structurally.
       */
      className="m-0 h-dvh max-h-dvh w-screen max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
    >
      {/*
        The panel sits inside a full-viewport flex box rather than being the
        dialog itself, which gives us a click target for "outside the panel"
        without swallowing clicks inside it.
      */}
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        className="flex h-full w-full items-end justify-center sm:items-center sm:p-6"
      >
        <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-card border border-line bg-paper shadow-overlay sm:max-h-[88dvh] sm:max-w-2xl sm:rounded-card">
          {/*
            The way out, pinned to the PANEL rather than to the content.

            It used to sit inside the scrolling body, over the photograph — so
            reading down to the sixth option group carried it 1,600px off the
            top of the screen and left a customer with no way out but the
            browser's back button. Which is also why this read as "the page is
            scrolling": the thing that should have stayed still was moving.

            Absolute against the panel, and a sibling of the scroll area rather
            than a child of it, so no amount of scrolling can reach it. It
            keeps its own background and border because once the photograph
            has scrolled past it is floating over text.
          */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper/90 text-ink shadow-card backdrop-blur-sm transition-colors hover:bg-surface-sunken"
          >
            <span className="sr-only">Close {item.name}</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>

          {/* ── Scrolling body ─────────────────────────────────────────── */}
          {/*
            `min-h-0` matters: a flex child's default `min-height: auto` refuses
            to shrink below its content, so without it this box grows to fit
            six option groups and pushes the footer — and the add button — off
            the bottom of the panel instead of scrolling.
          */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="relative">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-sunken sm:aspect-[16/9]">
                <FoodImage
                  src={photoSrc}
                  alt={item.image.alt}
                  categoryId={item.categoryId}
                  priority
                  sizes="(max-width: 640px) 100vw, 42rem"
                  glyphClassName="h-20 w-20"
                />

                {!item.available && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
                    <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-inverse">
                      {t("soldOut")}
                    </span>
                  </div>
                )}
              </div>

            </div>

            <div className="px-4 py-5 sm:px-6 sm:py-6">
              {credit && (
                <p className="-mt-1 mb-4 text-xs text-ink-subtle">
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

              <div className="flex items-start justify-between gap-4">
                <h2
                  id={headingId}
                  className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
                >
                  {item.name}
                </h2>
                <p className="shrink-0 text-xl font-semibold tabular-nums text-ink sm:text-2xl">
                  {formatMoney(item.basePrice)}
                </p>
              </div>

              <p className="mt-3 leading-relaxed text-ink-muted">
                {item.description}
              </p>

              {/* Every dietary tag, not the shortened set the card shows. */}
              {item.tags.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <li key={tag}>
                      <DietaryBadge tag={tag} />
                    </li>
                  ))}
                </ul>
              )}

              {/*
                Stated either way. "No listed allergens" is information; an
                absent block is ambiguous, and ambiguity is the wrong answer to
                an allergen question.
              */}
              <div className="mt-5 rounded-control border border-line bg-surface p-4">
                <h3 className="text-sm font-semibold text-ink">{t("allergens")}</h3>
                {item.allergens.length > 0 ? (
                  <p className="mt-1.5 text-sm capitalize leading-relaxed text-ink-muted">
                    {item.allergens.join(", ")}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                    No listed allergens.
                  </p>
                )}
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  Prepared in a kitchen that handles all major allergens. Call us
                  on anything critical.
                </p>
              </div>

              <p className="mt-3 text-sm text-ink-subtle">
                Cooked to order · about {item.kitchenMinutes}{" "}
                {item.kitchenMinutes === 1 ? "minute" : "minutes"} in the kitchen
              </p>

              {!item.available && (
                <p
                  role="status"
                  className="mt-5 rounded-control border border-line bg-surface-sunken p-4 text-sm text-ink-muted"
                >
                  This dish is sold out for now. Everything else on the menu is
                  still available.
                </p>
              )}

              <div className="mt-6 border-t border-line pt-6">
                <ProductCustomizer
                  item={item}
                  onAdded={onClose}
                  actionSlot={footer}
                />
              </div>
            </div>
          </div>

          {/*
            The action, outside the scrolling body so a burger with six option
            groups never hides its own add button. `pb-[env(safe-area-inset-bottom)]`
            keeps it clear of the home indicator on a phone.
          */}
          <div
            ref={setFooter}
            className="border-t border-line bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_18px_-14px_rgba(38,26,18,0.45)] sm:px-6"
          />
        </div>
      </div>
    </dialog>
  );
}
