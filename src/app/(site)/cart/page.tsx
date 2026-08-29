import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { resolveMenuPhotos } from "@/lib/data/photos";
import { getMenuItems } from "@/lib/data/repository";
import { isAddressLookupConfigured } from "@/lib/fulfillment/address-lookup";

/* Translated, so the browser tab and any share card match the page. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("cart") };
}

/**
 * Server shell for the cart.
 *
 * The cart itself must be a client component — it reads the store — but photo
 * resolution touches the filesystem, and mapping a line back to its category
 * (for the placeholder glyph) needs the menu. Both are resolved here and passed
 * down, so the client never has to fetch anything.
 */
export default async function CartPage() {
  const items = await getMenuItems();
  const categoryByItemId = Object.fromEntries(
    items.map((item) => [item.id, item.categoryId]),
  );

  return (
    <CartView
      photoMap={resolveMenuPhotos(items)}
      categoryByItemId={categoryByItemId}
      /* Read here, on the server, so the credential a real provider needs never
         has a route into the client bundle. */
      addressLookupEnabled={isAddressLookupConfigured()}
    />
  );
}
