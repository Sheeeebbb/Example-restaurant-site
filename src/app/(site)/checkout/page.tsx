import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/CheckoutView";

/* Translated, so the browser tab and any share card match the page. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title") };
}

export default function CheckoutPage() {
  return <CheckoutView />;
}
