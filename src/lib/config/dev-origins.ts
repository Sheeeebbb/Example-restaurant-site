/**
 * Which origins are allowed to load the dev server's internals.
 *
 * `next dev` refuses cross-origin requests for `/_next/*` and `/__nextjs*`
 * unless the requesting origin is on an allowlist. The default list is only
 * `localhost`, so opening the dev server from a phone at `http://192.168.x.x:3000`
 * gets HTML and CSS — those are same-origin document requests — and a 403 on
 * every JavaScript chunk. The page renders, looks finished, and never hydrates:
 * no menu filtering, no cart, nothing responds to a tap. It reads exactly like
 * a broken touchscreen, which is why it is worth being explicit about here.
 *
 * What that check defends against is a public web page telling a developer's
 * browser to go and read their dev server. In that attack the Origin header is
 * the attacker's own public domain, so the fix is to allow private network
 * origins and nothing else — a page whose origin is a private address is
 * already being served from inside the same network as the dev server.
 *
 * Nothing here applies to `next build` / `next start`. The check exists only in
 * development; a deployed site is unaffected by this file.
 */

/**
 * `ALLOWED_DEV_ORIGINS` — extra hosts, comma or whitespace separated.
 *
 * For the cases the private ranges cannot cover: a tunnel (`*.ngrok-free.app`,
 * `*.trycloudflare.com`), a staging hostname, a container's published name.
 * Hosts only — no scheme, no port. `*` matches one label, `**` matches several,
 * the way Next matches them.
 *
 *   ALLOWED_DEV_ORIGINS="urban-table.ngrok-free.app,*.trycloudflare.com" npm run dev
 */
const ENV_VAR = "ALLOWED_DEV_ORIGINS";

/**
 * The private address space, as host patterns.
 *
 * Every address a router hands out on a home or office network: 10/8,
 * 172.16/12 — which needs its sixteen second octets spelled out, because a
 * single `*` there would also match the public 172.32+ range — and 192.168/16.
 * Then 100.64/10, the range Tailscale and similar hand out, since a mesh VPN is
 * the other common way a phone reaches a laptop's dev server. Plus loopback,
 * and the mDNS names a phone resolves when it looks for a laptop by name.
 *
 * None of these are reachable from the public internet, which is the property
 * that makes them safe to allow and every other address not.
 */
function privateNetworkPatterns(): readonly string[] {
  const classB = Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`);
  const cgnat = Array.from({ length: 64 }, (_, i) => `100.${64 + i}.*.*`);
  return [
    "localhost",
    "*.localhost",
    "**.localhost",
    "*.local",
    "**.local",
    "127.*.*.*",
    "10.*.*.*",
    ...classB,
    "192.168.*.*",
    ...cgnat,
  ];
}

/**
 * A pattern that matches every host is not an allowlist.
 *
 * `**`, `*.*.*.*` and friends would turn the check off while looking like
 * configuration, so they are dropped with a warning rather than honoured. A
 * real pattern names something: it has at least one character that isn't a
 * wildcard or a separator.
 */
const namesSomething = (pattern: string) => /[a-z0-9]/i.test(pattern);

/** Split on commas or whitespace, strip anything that isn't a bare host. */
export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];

  const seen = new Set<string>();
  for (const raw of value.split(/[\s,]+/)) {
    if (!raw) continue;

    // Tolerate a pasted URL — "http://host:3000/" — but keep only the host,
    // which is the only part Next matches on.
    const host = raw
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .trim();

    if (!host) continue;

    if (!namesSomething(host)) {
      console.warn(
        `[${ENV_VAR}] Ignoring "${raw}": a pattern that matches every host would disable the check it configures.`,
      );
      continue;
    }

    seen.add(host);
  }

  return [...seen];
}

/**
 * The allowlist `next.config.ts` passes to Next.
 *
 * Private ranges always, so that opening the dev server from a phone on the
 * same wifi works without anyone having to discover this file, plus whatever
 * `ALLOWED_DEV_ORIGINS` adds. Takes the environment as an argument so it can be
 * tested without writing to `process.env`.
 */
export function allowedDevOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return [...privateNetworkPatterns(), ...parseAllowedOrigins(env[ENV_VAR])];
}
