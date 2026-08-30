import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { ApplyPromoButton } from "./ApplyPromoButton";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import { FIRST_ORDER_PROMO } from "@/lib/data/promotions";

/**
 * The first-order offer.
 *
 * Every value shown — the code, the percentage, the minimum spend — is read
 * from the promotion record in `lib/data/promotions.ts`, which is the same
 * record the cart validates against. The banner therefore cannot advertise an
 * offer the checkout would refuse.
 */
export async function PromoBanner() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const promo = FIRST_ORDER_PROMO;

  return (
    <section aria-labelledby="promo-heading" className="bg-paper">
      <Container className="py-4 sm:py-8">
        <div className="overflow-hidden rounded-[1.75rem] bg-poster px-6 py-12 text-poster-fg ring-1 ring-poster-fg/10 sm:px-12 sm:py-16">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-poster-accent">
                {t("promoEyebrow")}
              </p>
              <h2
                id="promo-heading"
                className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl"
              >
                {t("promoHeadline", { value: promo.value })}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-poster-muted">
                {t("promoBody", {
                  minimum: formatMoney(promo.minimumSubtotal, locale),
                })}
              </p>
            </div>

            <div className="w-full shrink-0 lg:w-auto">
              <p className="text-sm text-poster-muted">{t("promoCode")}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-[0.12em] sm:text-4xl">
                {promo.code}
              </p>
              <ApplyPromoButton code={promo.code} className="mt-4 w-full lg:w-auto" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
