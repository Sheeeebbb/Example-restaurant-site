import { NextResponse } from "next/server";
import { getAddressLookupProvider } from "@/lib/fulfillment/address-lookup";
import { checkPostalCode } from "@/lib/fulfillment/postal-code";
import type { AddressSuggestion } from "@/lib/fulfillment/address-autofill";

/**
 * Postal code → address suggestion.
 *
 * The browser asks this endpoint rather than a lookup service directly, so the
 * service's credential — if it ever has one — stays on the server. That is the
 * whole reason this route exists: a keyed API called from a client component
 * ships the key to every visitor.
 *
 * It answers about ANY well-formed postal code, in the delivery area or not.
 * Lookup and delivery eligibility are separate questions: someone typing a code
 * we do not drive to should still be told what their address is, and then told
 * separately that we cannot bring food to it. An earlier version refused to
 * look up out-of-area codes, which made this endpoint a second, quieter
 * implementation of the delivery rule — `checkPostalCode` is the only one.
 */

/** Nothing else is sent to the browser, whatever the provider returned. */
interface PublicSuggestion {
  street?: string;
  city?: string;
  municipality?: string;
  region?: string;
  streetOptions?: string[];
}

const MAX_OPTIONS = 6;

function toPublic(suggestion: AddressSuggestion | null): PublicSuggestion | null {
  if (!suggestion) return null;
  const out: PublicSuggestion = {};
  if (suggestion.street) out.street = suggestion.street;
  if (suggestion.city) out.city = suggestion.city;
  if (suggestion.municipality) out.municipality = suggestion.municipality;
  if (suggestion.region) out.region = suggestion.region;
  if (suggestion.streetOptions?.length) {
    out.streetOptions = suggestion.streetOptions.slice(0, MAX_OPTIONS);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * A small in-process cap, so one browser cannot sit on the Kadaster's service
 * on our behalf. Not a security control — this endpoint exposes nothing secret
 * and the same data is public — just courtesy to a free public API.
 *
 * Keyed by IP, in memory, and lost on restart, which is the right weight for
 * what it defends.
 */
const WINDOW_MS = 60_000;
/*
 * Generous, because this is courtesy rather than a control: several customers
 * can share one address behind a café's NAT, and a single customer typing a
 * code and then correcting it legitimately spends a handful. The data cache
 * absorbs repeats, so what this actually caps is a script.
 */
const MAX_PER_WINDOW = 60;
const seen = new Map<string, { count: number; resetAt: number }>();

function withinRate(key: string): boolean {
  const now = Date.now();
  const entry = seen.get(key);
  if (!entry || now > entry.resetAt) {
    seen.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (seen.size > 5_000) {
      for (const [k, v] of seen) if (now > v.resetAt) seen.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("postalCode") ?? "";

  // Length is checked before anything else: an unbounded query string should
  // never reach a regex, let alone the provider.
  if (raw.length > 16) {
    return NextResponse.json({ ok: false, error: "That isn't a postal code." }, { status: 400 });
  }

  const check = checkPostalCode(raw);

  /*
   * Only a code with a complete set of area digits is worth asking about.
   * "empty", "incomplete" and "malformed" are all answered here rather than
   * being spent on the provider — but note what is NOT checked: whether we
   * deliver there.
   */
  if (check.area === null) {
    return NextResponse.json(
      { ok: false, error: "Enter a complete postal code." },
      { status: 400 },
    );
  }

  const provider = getAddressLookupProvider();

  if (!provider) {
    // 501, not 500: nothing has failed. The capability is simply switched off,
    // and the client is expected to carry on with a hand-typed address.
    return NextResponse.json(
      { ok: false, error: "Address lookup is not configured." },
      { status: 501 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!withinRate(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many lookups. Type your address instead." },
      { status: 429 },
    );
  }

  try {
    const suggestion = toPublic(await provider.lookup(check.area, check.letters));
    /*
     * A code the register does not know is a 200 with nothing in it, not an
     * error: the customer's address may be new, and the form's job is then to
     * get out of the way rather than to argue.
     */
    return NextResponse.json({ ok: true, suggestion });
  } catch {
    /*
     * A lookup outage must never block an order — the customer types the
     * address. Nothing about the failure is echoed back: a provider's error
     * text is not ours to forward, and the postal code is not logged, because
     * a log of every code typed into the form is a log of where people live.
     */
    return NextResponse.json(
      { ok: false, error: "Address lookup is unavailable." },
      { status: 502 },
    );
  }
}
