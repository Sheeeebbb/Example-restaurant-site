import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { allowedDevOrigins } from "./src/lib/config/dev-origins";
import { securityHeaders } from "./src/lib/config/security-headers";

const nextConfig: NextConfig = {
  /*
   * Which origins may load dev-server internals. Private network ranges by
   * default so that `next dev` can be opened from a phone on the same wifi —
   * without that, every `/_next/*` chunk 403s and the page never hydrates.
   * `ALLOWED_DEV_ORIGINS` adds tunnels and staging hostnames. Development
   * only; `next start` ignores it. See src/lib/config/dev-origins.ts.
   */
  allowedDevOrigins: allowedDevOrigins(),

  /*
   * `X-Powered-By: Next.js` names the framework and its presence to anyone
   * scanning. It buys nothing and is one flag to turn off.
   */
  poweredByHeader: false,

  /*
   * Security headers on every response — CSP, nosniff, frame denial, referrer
   * policy, and HSTS outside development. The policy and the reasoning behind
   * each value live in src/lib/config/security-headers.ts.
   *
   * `/:path*` matches the root as well as every nested route, so this covers
   * pages, API routes, and the static files under public/ and /_next/.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },

  images: {
    /*
     * AVIF first, WebP second, original as the last resort. Food photography is
     * the heaviest thing this site will serve — twenty-five dish photographs plus
     * a hero — and AVIF typically lands around half the bytes of a comparable
     * JPEG at the sizes these cards use.
     */
    formats: ["image/avif", "image/webp"],
    /*
     * Matched to the layout rather than left at the defaults: cards sit in a
     * 1/2/3-column grid and the product page uses a half-width column, so these
     * are the widths actually requested. Fewer entries means fewer variants to
     * generate and cache.
     */
    deviceSizes: [390, 640, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    /* A dish photograph is served for a long time and never changes in place. */
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

/*
 * next-intl, in its "without i18n routing" mode: the locale comes from a cookie
 * rather than a URL segment, so every existing path keeps working. An order
 * tracking link already in someone's messages, a bookmarked dish, an API route
 * — none of them change. See src/i18n/README.md for why that trade was made.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
