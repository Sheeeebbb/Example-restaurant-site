"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart/store";
import { Button } from "@/components/ui/Button";

/**
 * The hero's two calls to action.
 *
 * These do real work: each sets the cart's fulfilment mode — which drives
 * delivery fees, minimum order values, and lead times downstream — before
 * sending the customer to the menu. It is the same store the checkout reads, so
 * the choice made here survives all the way to the order.
 */
export function OrderModeButtons({ className = "" }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations("home");
  const setFulfillmentType = useCartStore((state) => state.setFulfillmentType);

  const start = (type: "delivery" | "pickup") => {
    setFulfillmentType(type);
    router.push("/menu");
  };

  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <Button size="lg" onClick={() => start("delivery")}>
        {t("orderDelivery")}
      </Button>
      <Button size="lg" variant="secondary" onClick={() => start("pickup")}>
        {t("orderPickup")}
      </Button>
    </div>
  );
}
