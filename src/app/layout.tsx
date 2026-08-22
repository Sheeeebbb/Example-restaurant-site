import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CartHydration } from "@/components/cart/CartHydration";
import { RESTAURANT } from "@/lib/config/restaurant";
import "./globals.css";

/**
 * Two typefaces, each with a job.
 *
 * Fraunces (display serif) carries warmth and craft, and appears only in
 * headings and the wordmark. Inter handles every piece of UI text, where
 * legibility at small sizes beats personality. Both are self-hosted by
 * `next/font`, so there is no render-blocking request to Google and no layout
 * shift when they load.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${RESTAURANT.name} — ${RESTAURANT.tagline}`,
    template: `%s · ${RESTAURANT.name}`,
  },
  description: RESTAURANT.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        {/*
          First tab stop on every page — WCAG 2.4.1 bypass blocks.

          `sr-only` + `focus:not-sr-only` is Tailwind's own pattern and needs no
          custom CSS. An earlier hand-rolled version parked the link at
          `top: -100%` and moved it back on `:focus`; that rule lost the cascade
          inside `@layer utilities`, so the link took focus while staying 900px
          off-screen — a skip link that could be focused but never seen.

          Padding is applied in the focus variant because `not-sr-only` resets
          `padding` to 0; a plain `px-4` would be overridden and the visible
          link would be a cramped box with its text against the edges.
        */}
        <a
          href="#main"
          className="sr-only rounded-control bg-ember text-sm font-medium text-on-ember focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-100 focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>

        <CartHydration />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
