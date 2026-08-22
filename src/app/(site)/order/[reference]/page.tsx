import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order/OrderConfirmation";
import { normalizeOrderReference } from "@/lib/order/reference";
import { resolveMenuPhotos } from "@/lib/data/photos";
import { getMenuItems } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Order confirmed" };

/**
 * The confirmation lives at its own URL, keyed by order reference.
 *
 * That is what makes a refresh harmless: the page holds no state of its own, so
 * reloading simply looks the order up again. It also gives the customer
 * something to bookmark and quote on the phone.
 */
export default async function OrderPage({ params }: PageProps<"/order/[reference]">) {
  const { reference } = await params;
  // The fallback glyph is per category, so the map is needed for a line whose
  // photograph has not been supplied yet.
  const items = await getMenuItems();
  const categoryByItemId = Object.fromEntries(
    items.map((item) => [item.id, item.categoryId]),
  );
  // Photo resolution touches the filesystem, so it happens here and the map is
  // passed down — the confirmation itself is a client component.
  return (
    <OrderConfirmation
      reference={normalizeOrderReference(reference)}
      photoMap={resolveMenuPhotos()}
      categoryByItemId={categoryByItemId}
    />
  );
}
