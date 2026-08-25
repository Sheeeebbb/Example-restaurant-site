import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { CartHydration } from "@/components/cart/CartHydration";
import { TouchActiveState } from "@/components/layout/TouchActiveState";
import { RESTAURANT } from "@/lib/config/restaurant";
import "./globals.css";

/**
 * Root layout: document, fonts, and the cart's storage bridge — nothing else.
 *
 * Page chrome lives in the route-group layouts, because the customer site and
 * the staff area need entirely different shells.
 *
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
        <CartHydration />
        <TouchActiveState />
        {children}
      </body>
    </html>
  );
}
