import type { Metadata } from "next";
import { CheckoutReview } from "@/components/checkout/CheckoutReview";

export const metadata: Metadata = { title: "Review your order" };

export default function CheckoutPage() {
  return <CheckoutReview />;
}
