import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * The customer-facing shell.
 *
 * A route group, so the URLs are unchanged — `/menu` is still `/menu`. It
 * exists so the staff area can have a completely different chrome without the
 * root layout needing to know which one it is rendering, which a server layout
 * cannot find out anyway.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("nav");
  return (
    <>
      {/*
        First tab stop on every page — WCAG 2.4.1 bypass blocks.

        `sr-only` + `focus:not-sr-only` is Tailwind's own pattern and needs no
        custom CSS. Padding is applied in the focus variant because
        `not-sr-only` resets it.
      */}
      <a
        href="#main"
        className="sr-only rounded-control bg-ember text-sm font-medium text-on-ember focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-100 focus:px-4 focus:py-2"
      >
        {t("skipToContent")}
      </a>

      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
