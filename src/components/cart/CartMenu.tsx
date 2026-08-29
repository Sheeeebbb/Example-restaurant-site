"use client";

import { useTranslations } from "next-intl";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartButton } from "./CartButton";
import { FoodImage } from "@/components/menu/FoodImage";
import { QuantityStepper } from "@/components/menu/QuantityStepper";
import { useCartStore } from "@/lib/cart/store";
import { useLineRemoval } from "@/lib/cart/use-line-removal";
import { useCartSummary } from "@/lib/cart/selectors";
import { formatMoney } from "@/lib/money";

/**
 * The cart, previewed from the header.
 *
 * On a pointer device, hovering the cart opens a compact panel: what is in the
 * basket, at what quantity, for how much, with the controls to change any of it
 * — so adding a side never costs a round trip to the cart page and back.
 *
 * It holds NO cart state of its own. Every row reads `useCartStore` and every
 * figure comes from `useCartSummary`, the same derivation the cart page uses, so
 * a change made here lands in the badge, the cart page and the checkout at the
 * same instant. There is nothing to keep in sync because there is only one copy.
 *
 * On touch the panel never opens. `(hover: hover)` is the honest test for "this
 * pointer can hover"; a phone fails it, so the cart button stays exactly what it
 * was — a link to the cart page. Requiring a tap to open a preview, and a second
 * tap to reach the cart, would be a worse mobile cart than the one that already
 * works.
 *
 * On the cart page itself the whole control is withheld — button and panel
 * alike, on every screen size. A link to the page you are reading is noise, and
 * a preview of the cart floating above the cart is worse than noise. The route
 * is read with `usePathname`, the router's own answer, rather than anything
 * this component tracks for itself.
 */

/** Leaving the button for the panel crosses a gap; closing instantly loses it. */
const CLOSE_DELAY_MS = 140;

export function CartMenu({
  photoMap,
  categoryByItemId,
}: {
  photoMap: Record<string, string | null>;
  categoryByItemId: Record<string, string>;
}) {
  const t = useTranslations("cart");
  const pathname = usePathname();
  const lines = useCartStore((state) => state.lines);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const summary = useCartSummary();
  const { isLeaving, requestRemove, changeQuantity } = useLineRemoval();

  const [canHover, setCanHover] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  /*
   * Decided at runtime rather than by width: a small laptop has a mouse and a
   * large tablet does not. Starts false so the server render and a touch device
   * agree — the panel is an enhancement, never the only way in.
   */
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const cancelClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(
      () => setOpen(false),
      CLOSE_DELAY_MS,
    );
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // Escape closes it, as it would any transient layer.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const showPanel = canHover && open && hasHydrated;

  /*
   * Nothing at all on the cart page.
   *
   * Returned after every hook so the order of hooks stays identical on both
   * sides of the boundary — leaving early above would break the rules of hooks
   * the moment the customer navigated to or away from /cart.
   */
  if (pathname === "/cart") return null;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        if (!canHover) return;
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      /* Keyboard parity: tabbing onto the cart shows the same panel, and
         tabbing past its last control closes it again. */
      onFocus={() => canHover && setOpen(true)}
      onBlur={(event) => {
        if (
          !containerRef.current?.contains(event.relatedTarget as Node | null)
        ) {
          setOpen(false);
        }
      }}
    >
      <CartButton />

      {showPanel && (
        <div
          /*
             Capped and scrollable rather than tall: a nine-line cart must not
             curtain the page it is floating over. `right-0` keeps it inside the
             viewport on the right-hand edge where the cart button lives.
          */
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[22rem] overflow-hidden rounded-card border border-line bg-paper shadow-overlay"
        >
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
            <p className="font-display text-base font-semibold text-ink">
              {t("title")}
            </p>
            <p className="text-sm text-ink-muted">
              {summary.itemCount} {summary.itemCount === 1 ? "item" : "items"}
            </p>
          </div>

          {lines.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="font-display text-base font-semibold text-ink">
                {t("empty")}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Let&rsquo;s fix that. Pick your favorites from the menu.
              </p>
              <Link
                href="/menu"
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
              >
                Explore Menu
              </Link>
            </div>
          ) : (
            <>
              <ul className="max-h-[19rem] divide-y divide-line overflow-y-auto overscroll-contain">
                {lines.map((line) => (
                  /* Same exit as the cart page's rows, from the same hook: a
                     line removed here fades and collapses exactly as it would
                     there. See `CartLineRow` for why it is built this way. */
                  <li
                    key={line.lineId}
                    aria-hidden={isLeaving(line.lineId) || undefined}
                    className={`grid transition-[grid-template-rows,opacity] duration-[340ms] ease-out ${
                      isLeaving(line.lineId)
                        ? "grid-rows-[0fr] opacity-0"
                        : "grid-rows-[1fr] opacity-100"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex gap-3 px-4 py-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control border border-line bg-surface-sunken">
                          <FoodImage
                            src={photoMap[line.imageSrc] ?? null}
                            alt=""
                            categoryId={
                              categoryByItemId[line.menuItemId] ?? "cat-burgers"
                            }
                            sizes="48px"
                            glyphClassName="h-5 w-5"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-ink">
                              {line.name}
                            </p>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                              {formatMoney(line.unitPrice * line.quantity)}
                            </p>
                          </div>

                          {/* One line, truncated: the full breakdown is on the cart
                          page, and a preview that wraps to four rows is not one. */}
                          {line.selections.length > 0 && (
                            <p className="truncate text-xs text-ink-muted">
                              {line.selections
                                .map((choice) => choice.name)
                                .join(" · ")}
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <QuantityStepper
                              quantity={line.quantity}
                              onChange={(next) =>
                                changeQuantity(line.lineId, next)
                              }
                              label=""
                              allowRemove
                              itemName={line.name}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={() => requestRemove(line.lineId)}
                              disabled={isLeaving(line.lineId)}
                              className="min-h-9 rounded-control px-1.5 text-xs font-medium text-ink-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
                            >
                              Remove
                              <span className="sr-only">
                                {" "}
                                {line.name} from your cart
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-line px-4 py-3">
                {/*
                  Subtotal only. Delivery and any discount depend on choices the
                  customer has not made yet at this point, and quoting a total
                  here that changes on the cart page would be a promise taken
                  back.
                */}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink-muted">Subtotal</span>
                  <span className="font-display text-lg font-semibold tabular-nums text-ink">
                    {formatMoney(summary.totals.subtotal)}
                  </span>
                </div>

                <Link
                  href="/cart"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-hover"
                >
                  View cart &amp; checkout
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
