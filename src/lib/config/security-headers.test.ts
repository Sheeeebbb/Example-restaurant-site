import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

/**
 * The headers are only worth having if they are both present and survivable.
 * A CSP that blocks the app's own fonts is worse than no CSP, because it fails
 * in production and passes every test that never loads a page — so the shape of
 * the policy is asserted here, next to the reasoning that produced it.
 */
const dev = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
const prod = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

const find = (env: NodeJS.ProcessEnv, key: string) =>
  securityHeaders(env).find((h) => h.key.toLowerCase() === key.toLowerCase())?.value ?? null;

const csp = (env: NodeJS.ProcessEnv) => {
  const value = find(env, "Content-Security-Policy")!;
  const map: Record<string, string[]> = {};
  for (const directive of value.split(";")) {
    const [name, ...values] = directive.trim().split(/\s+/);
    if (name) map[name] = values;
  }
  return map;
};

describe("security headers", () => {
  it("sets the headers the audit asked for", () => {
    for (const key of [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
    ]) {
      expect(find(prod, key), key).not.toBeNull();
      expect(find(dev, key), key).not.toBeNull();
    }
  });

  it("refuses MIME sniffing and framing", () => {
    expect(find(prod, "X-Content-Type-Options")).toBe("nosniff");
    expect(find(prod, "X-Frame-Options")).toBe("DENY");
    expect(csp(prod)["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("does not leak the order reference to another site in a Referer", () => {
    // /order/UT-XXXXX is a bearer URL. Downgrades send nothing, cross-origin
    // sends the origin only.
    expect(find(prod, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  describe("the content security policy", () => {
    it("allows everything the application actually loads", () => {
      const p = csp(prod);
      // Fonts are self-hosted by next/font; images are files, API bytes, upload
      // previews (blob:) and optimiser placeholders (data:); fetches are all
      // same-origin API routes.
      expect(p["font-src"]).toEqual(["'self'"]);
      expect(p["img-src"]).toEqual(expect.arrayContaining(["'self'", "blob:", "data:"]));
      expect(p["connect-src"]).toContain("'self'");
      // The App Router streams its RSC payload through inline <script> tags.
      expect(p["script-src"]).toContain("'unsafe-inline'");
      // Tailwind and next/font both emit inline <style>.
      expect(p["style-src"]).toContain("'unsafe-inline'");
    });

    it("closes the injection routes that outlive most XSS filters", () => {
      const p = csp(prod);
      expect(p["object-src"]).toEqual(["'none'"]);
      expect(p["base-uri"]).toEqual(["'self'"]);
      expect(p["form-action"]).toEqual(["'self'"]);
      expect(p["default-src"]).toEqual(["'self'"]);
    });

    it("never upgrades insecure requests, which would break LAN development", () => {
      expect(csp(dev)["upgrade-insecure-requests"]).toBeUndefined();
      expect(csp(prod)["upgrade-insecure-requests"]).toBeUndefined();
    });

    it("lets the dev server compile and hot-reload, including over a LAN address", () => {
      const p = csp(dev);
      // Fast Refresh and Turbopack evaluate modules in the browser.
      expect(p["script-src"]).toContain("'unsafe-eval'");
      // The HMR socket goes back to whichever host served the page, so the
      // schemes are allowed rather than any particular address.
      expect(p["connect-src"]).toEqual(expect.arrayContaining(["ws:", "wss:"]));
    });

    it("grants the dev-only allowances in development only", () => {
      const p = csp(prod);
      expect(p["script-src"]).not.toContain("'unsafe-eval'");
      expect(p["connect-src"]).not.toContain("ws:");
      expect(p["connect-src"]).not.toContain("wss:");
    });
  });

  describe("HSTS", () => {
    it("is never sent in development, where the origin is http on a LAN address", () => {
      expect(find(dev, "Strict-Transport-Security")).toBeNull();
    });

    it("is sent outside development, for a year, across subdomains", () => {
      const value = find(prod, "Strict-Transport-Security")!;
      expect(value).toContain("max-age=31536000");
      expect(value).toContain("includeSubDomains");
    });

    it("does not commit the domain to the browsers' preload list", () => {
      // Preloading is close to irreversible and is not a config file's call.
      expect(find(prod, "Strict-Transport-Security")).not.toContain("preload");
    });

    it("can be switched off for a production build served over plain HTTP", () => {
      // Set at build time — Next evaluates headers() during `next build` and
      // freezes the result into routes-manifest.json, so `HSTS=off next start`
      // is too late to have any effect.
      expect(find({ ...prod, HSTS: "off" }, "Strict-Transport-Security")).toBeNull();
    });
  });

  it("leaves the payment permission available to this origin", () => {
    // Blocking it would break Apple Pay / Google Pay the day a real provider
    // replaces the mock one, in a place nobody would think to look.
    expect(find(prod, "Permissions-Policy")).toContain("payment=(self)");
  });
});
