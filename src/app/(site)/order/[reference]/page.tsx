import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order/OrderConfirmation";
import { normalizeOrderReference } from "@/lib/order/reference";

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
  return <OrderConfirmation reference={normalizeOrderReference(reference)} />;
}
