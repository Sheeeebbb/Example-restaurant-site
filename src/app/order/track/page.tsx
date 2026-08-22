import type { Metadata } from "next";
import { TrackOrderView } from "@/components/order/TrackOrderView";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackOrderPage() {
  return <TrackOrderView />;
}
