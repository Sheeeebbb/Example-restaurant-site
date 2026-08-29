import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { TrackOrderView } from "@/components/order/TrackOrderView";

/* Translated, so the browser tab and any share card match the page. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("order");
  return { title: t("trackTitle") };
}

export default function TrackOrderPage() {
  return <TrackOrderView />;
}
