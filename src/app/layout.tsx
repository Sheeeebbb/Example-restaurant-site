import type { Metadata, Viewport } from "next";
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

/**
 * The viewport, and one Android-specific instruction in it.
 *
 * `interactiveWidget: "resizes-content"` decides what the on-screen keyboard
 * does to the page. Chrome for Android's default is `resizes-visual`: the
 * keyboard slides over the page and the LAYOUT viewport keeps its full height,
 * so `100dvh` does not change and anything anchored to the bottom — the product
 * panel's Add button, the sticky add bar on a product page — stays where the
 * bottom of the screen used to be, which is now underneath the keyboard. The
 * customer types a note, then cannot reach the button that uses it.
 *
 * `resizes-content` shrinks the layout viewport to the space the keyboard
 * leaves, so `dvh` and every sticky footer follow it up the screen. Nothing
 * else about the page changes, and browsers that do not know the property
 * ignore it.
 *
 * The rest is Next's default (`width=device-width, initial-scale=1`), written
 * out here because it is now sharing a tag with something worth explaining.
 * Note what is absent: no `maximum-scale`, no `user-scalable=no`. Pinch zoom
 * stays available, which people with low vision rely on.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

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
