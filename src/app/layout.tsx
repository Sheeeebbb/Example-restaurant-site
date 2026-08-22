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
        {/* First tab stop on every page — WCAG 2.4.1 bypass blocks. */}
        <a href="#main" className="skip-link rounded-control bg-ember px-4 py-2 text-sm font-medium text-on-ember">
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
