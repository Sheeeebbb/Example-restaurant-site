/**
 * The response headers every route is served with.
 *
 * These are set here, in the application, rather than at a reverse proxy —
 * there is no proxy configuration in this repository, so `next start` is
 * currently the edge, and a header that only exists in someone's nginx file is
 * a header this project cannot test. `next.config.ts` applies them to every
 * response, including the ones served straight out of `public/` and `/_next/`.
 *
 * If a hosting layer is added later that sets any of these itself, delete it
 * from here rather than sending two of them: a duplicated CSP is not the union
 * of the two policies, it is the intersection, and the stricter of a pair
 * nobody is reading together is how a site breaks in production only.
 *
 * `src/proxy.ts` is deliberately not used for this. It matches `/admin/*` and
 * `/api/admin/*` only, and widening it to every route to attach headers would
 * run a function on requests that are currently served as static files.
 */

/** One entry in Next's `headers()` output. */
export interface HeaderEntry {
  key: string;
  value: string;
}

/**
 * What the browser is allowed to load, and from where.
 *
 * The site is entirely same-origin at the subresource level, which is what
 * makes a policy this tight possible:
 *
 *   • Fonts come from `next/font/google`, which downloads Inter and Fraunces at
 *     build time and serves them from `/_next/static/media`. Nothing is fetched
 *     from Google at runtime, so `font-src 'self'` is the whole story.
 *   • Photographs are files in `public/menu/` or bytes from
 *     `/api/menu-image/[id]`, both same-origin. `blob:` is for the upload
 *     preview in `ImageField` — staff pick a file, and it is shown from an
 *     object URL before it is ever sent. `data:` covers inline SVG and the
 *     image optimiser's placeholders.
 *   • Every fetch the client makes is to this origin's own API routes.
 *   • The only external URLs in the codebase are the social links in the footer
 *     and the photo-credit links on /about. Those are navigations, and CSP does
 *     not govern where a link may point.
 *
 * `script-src` carries `'unsafe-inline'`, and that is a real weakening worth
 * being honest about. The App Router streams the RSC payload to the browser as
 * a sequence of inline `<script>self.__next_f.push(...)</script>` tags; a
 * policy without `'unsafe-inline'` blocks them and the page never hydrates.
 * The alternative is a per-request nonce, which has to be generated in the
 * proxy and therefore makes every currently-static page dynamic. That is a
 * rendering-architecture decision, not a header change, so it is left alone
 * here — see the note in the audit report.
 *
 * What the policy still buys, with that caveat: `object-src 'none'` and
 * `base-uri 'self'` close the two injection routes that survive most
 * XSS filters, `form-action 'self'` stops an injected form posting the
 * checkout elsewhere, and `frame-ancestors 'none'` is the actual clickjacking
 * control — `X-Frame-Options` below is only its legacy twin.
 *
 * `upgrade-insecure-requests` is deliberately absent. It would rewrite this
 * site's own http:// requests to https:// on a LAN address that has no
 * certificate, breaking exactly the development setup this project is used in.
 */
function contentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "frame-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  if (isDev) {
    /*
     * Two additions, both only for `next dev`, and neither reaches a build.
     *
     * React Fast Refresh and Turbopack compile modules in the browser, which is
     * `eval` by any other name. And the HMR channel is a WebSocket opened back
     * to whichever host the page was loaded from — `localhost:3000` at a desk,
     * `192.168.x.x:3000` from a phone on the same wifi. `ws:` and `wss:` are
     * listed as schemes rather than hosts precisely so the LAN case works
     * without anyone having to name their laptop's address here.
     */
    directives["script-src"].push("'unsafe-eval'");
    directives["connect-src"].push("ws:", "wss:");
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/**
 * HSTS, and why it is conditional.
 *
 * The header tells a browser to refuse plain http:// to this host for a year.
 * Sent by a development server reached at `http://192.168.1.20:3000`, that is
 * either ignored or actively harmful depending on the browser's mood, and it
 * is not undoable from the server side — the browser has already written it
 * down. So it is emitted only outside development, where TLS is the assumption.
 *
 * `HSTS=off npm run build` turns it off, for the case of a production build
 * meant to be served over plain HTTP on a LAN to check something. It has to be
 * set at BUILD time, not at `next start`: Next evaluates `headers()` once
 * during the build and writes the result into `.next/routes-manifest.json`, so
 * by the time the server is running there is nothing left to decide. The same
 * is true of every value in this file — it is a build-time policy, and changing
 * one means rebuilding.
 *
 * `preload` is deliberately not included. Submitting a host to the browsers'
 * preload list is close to irreversible, takes months to unwind, and is not a
 * decision a config file should make on someone's behalf.
 */
function strictTransportSecurity(
  isDev: boolean,
  env: NodeJS.ProcessEnv,
): string | null {
  if (isDev) return null;
  if (env.HSTS === "off") return null;
  return "max-age=31536000; includeSubDomains";
}

/**
 * The header set, resolved for the environment this process is running in.
 *
 * Called once, at config load, by `next.config.ts`.
 */
export function securityHeaders(
  env: NodeJS.ProcessEnv = process.env,
): HeaderEntry[] {
  const isDev = env.NODE_ENV === "development";

  const headers: HeaderEntry[] = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },

    /* Trust the declared Content-Type. Without this a browser is free to sniff
     * an uploaded dish photograph as HTML and run what it finds inside. */
    { key: "X-Content-Type-Options", value: "nosniff" },

    /* The pre-CSP clickjacking control, kept for browsers and scanners that
     * still look for it. `frame-ancestors 'none'` above is the one that counts
     * where both are understood, and the two agree. */
    { key: "X-Frame-Options", value: "DENY" },

    /* Full URL to this origin, origin only when crossing to another https
     * origin, nothing at all when downgrading to http. It matters here because
     * an order-tracking URL contains the order reference, and that reference is
     * what unlocks the order's status — it should not travel in a Referer to
     * Instagram because someone clicked the footer from the tracking page. */
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

    /* Hardware this site has no use for, declined up front. `payment` is left
     * available to this origin rather than blocked outright: the current
     * provider is a mock card form that needs nothing, but blocking it here
     * would quietly break Apple Pay or Google Pay the day a real provider is
     * wired in, and a header is a bad place to hide that surprise. */
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), usb=(), payment=(self)",
    },
  ];

  const hsts = strictTransportSecurity(isDev, env);
  if (hsts) headers.push({ key: "Strict-Transport-Security", value: hsts });

  return headers;
}
