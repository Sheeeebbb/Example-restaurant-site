import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { resolveMenuPhotos } from "@/lib/data/photos";

export const metadata: Metadata = { title: "Your cart" };

/**
 * Server shell for the cart.
 *
 * The cart itself must be a client component — it reads the store — but photo
 * resolution touches the filesystem. It is resolved here and passed down, so
 * the client never has to fetch anything.
 */
export default function CartPage() {
  return <CartView photoMap={resolveMenuPhotos()} />;
}
