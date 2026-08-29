/**
 * Address autofill — the seam, and the service behind it.
 *
 * The browser never talks to a lookup service. It asks `/api/address-lookup`,
 * which calls this module on the server, so a credential — if a provider ever
 * needs one — stays where it belongs. This module must not be imported into a
 * client component; `address-autofill.ts` holds the pure part the form uses.
 *
 * ── The provider ────────────────────────────────────────────────────────────
 * PDOK Locatieserver, the Dutch government's own geocoding service over the
 * BAG (Basisregistratie Adressen en Gebouwen) — the statutory register that
 * every Dutch address is defined by. It is the source the commercial services
 * resell, it needs no key, and it is run by the Kadaster inside the EU.
 *
 * ── Connecting a different one ──────────────────────────────────────────────
 *   1. Write a class implementing `AddressLookupProvider`.
 *   2. Return it from `getAddressLookupProvider()` behind its own env name:
 *
 *        if (env.ADDRESS_LOOKUP_PROVIDER === "loqate" && env.ADDRESS_LOOKUP_KEY) {
 *          return new LoqateProvider(env.ADDRESS_LOOKUP_KEY);
 *        }
 *
 * A key would be read HERE and nowhere else. A `NEXT_PUBLIC_` key would be
 * shipped to every visitor and billed to whoever found it.
 */

import type { AddressSuggestion } from "./address-autofill";

export interface AddressLookupProvider {
  /**
   * Resolves a postal code to whatever it reliably identifies.
   *
   * `area` is the digits, `letters` the suffix when the customer typed all of
   * it. Returns null when the service knows nothing about the code — which is
   * an answer, not a failure. Throws only when the service itself failed.
   */
  lookup(area: string, letters: string | null): Promise<AddressSuggestion | null>;
}

/**
 * How many streets are still worth offering as a menu.
 *
 * Four digits of a Dutch postal code cover a whole town — 8934 spans 59
 * streets, which is a list nobody reads. A village whose code covers three
 * streets is a different matter: those are worth showing. Above this, the
 * customer is better served by typing the two letters and being told exactly.
 */
const MAX_STREET_OPTIONS = 6;

/** Rows to ask PDOK for. Enough to see whether the streets agree, and to fill a short menu. */
const ROWS = 40;

const DEFAULT_BASE_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const DEFAULT_TIMEOUT_MS = 3500;
/** How long a resolved postal code stays good for. A day: addresses change, slowly. */
const CACHE_SECONDS = 60 * 60 * 24;

/** Exactly the fields we read. Anything else PDOK returns is dropped on the floor. */
interface LocatieserverDoc {
  straatnaam?: unknown;
  woonplaatsnaam?: unknown;
  gemeentenaam?: unknown;
  provincienaam?: unknown;
  postcode?: unknown;
}

/** A string field from the provider, or undefined if it is not one, or is empty, or is absurd. */
function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  return trimmed;
}

/** The single value every row agrees on, or undefined when they disagree. */
function consensus(values: (string | undefined)[]): string | undefined {
  const present = values.filter((value): value is string => Boolean(value));
  if (present.length === 0) return undefined;
  const unique = new Set(present);
  return unique.size === 1 ? present[0] : undefined;
}

export class PdokLocatieserverProvider implements AddressLookupProvider {
  constructor(
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    /**
     * Sent as the User-Agent so the Kadaster can see who is calling and reach
     * us if this starts misbehaving. Their fair-use policy asks for it.
     */
    private readonly contact: string | null = null,
  ) {}

  async lookup(area: string, letters: string | null): Promise<AddressSuggestion | null> {
    const code = `${area}${letters ?? ""}`;
    const url = new URL(this.baseUrl);
    /*
     * Only the postal code is sent. Not the house number, not the name, not
     * the phone number, not the order — the provider has no need of them and
     * a postal code on its own identifies a street, not a person.
     */
    url.searchParams.set("q", code);
    url.searchParams.set("fq", "type:postcode");
    url.searchParams.set("rows", String(ROWS));

    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: this.contact
        ? { Accept: "application/json", "User-Agent": this.contact }
        : { Accept: "application/json" },
      /*
       * A postal code's street does not change between two customers typing
       * it, so the same code is fetched once and served from the data cache
       * after that — most of the traffic this endpoint would otherwise send.
       *
       * With a lifetime, though, not forever: the register gains streets as
       * they are built, and an entry that never expires would keep answering
       * "we don't know that one" about a new address for as long as the
       * process lived.
       */
      cache: "force-cache",
      next: { revalidate: CACHE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`Locatieserver responded ${response.status}`);
    }

    const body: unknown = await response.json();
    return this.readSuggestion(body, code);
  }

  /**
   * Turns a provider response into the few fields the application uses.
   *
   * Everything is re-validated here rather than trusted: the response is parsed
   * defensively, each field is checked for being a plausible string, and rows
   * whose postal code is not the one asked about are discarded. A provider that
   * starts answering differently should produce no suggestion, never a wrong
   * address or a crash.
   */
  private readSuggestion(body: unknown, code: string): AddressSuggestion | null {
    if (typeof body !== "object" || body === null) return null;
    const response = (body as { response?: unknown }).response;
    if (typeof response !== "object" || response === null) return null;
    const docs = (response as { docs?: unknown }).docs;
    if (!Array.isArray(docs)) return null;

    const rows = (docs as LocatieserverDoc[])
      .filter((doc): doc is LocatieserverDoc => typeof doc === "object" && doc !== null)
      // The query is a prefix search, so a four-digit code returns every code
      // that starts with it. Anything that does not is not this customer's.
      .filter((doc) => (readString(doc.postcode) ?? "").startsWith(code));

    if (rows.length === 0) return null;

    const streets = rows.map((doc) => readString(doc.straatnaam));
    const suggestion: AddressSuggestion = {};

    // City, municipality and province only when the whole set agrees. A code
    // straddling two towns fills neither rather than guessing one.
    const city = consensus(rows.map((doc) => readString(doc.woonplaatsnaam)));
    const municipality = consensus(rows.map((doc) => readString(doc.gemeentenaam)));
    const region = consensus(rows.map((doc) => readString(doc.provincienaam)));

    if (city) suggestion.city = city;
    if (municipality && municipality !== city) suggestion.municipality = municipality;
    if (region) suggestion.region = region;

    const street = consensus(streets);
    if (street) {
      suggestion.street = street;
    } else {
      const distinct = [...new Set(streets.filter((value): value is string => Boolean(value)))];
      // More than a short menu's worth means the code is a whole town. Say
      // nothing about the street; the two letters are what narrows it.
      if (distinct.length > 1 && distinct.length <= MAX_STREET_OPTIONS) {
        suggestion.streetOptions = distinct.sort((a, b) => a.localeCompare(b, "nl"));
      }
    }

    return Object.keys(suggestion).length > 0 ? suggestion : null;
  }
}

/**
 * The active provider, or null when lookup is switched off.
 *
 * Server-only. Callers must handle null rather than assuming a lookup exists —
 * autofill is an accelerator, and every field it would have filled can still be
 * typed by hand.
 */
export function getAddressLookupProvider(
  env: NodeJS.ProcessEnv = process.env,
): AddressLookupProvider | null {
  // Anything other than the provider's own name switches it off, so
  // ADDRESS_LOOKUP_PROVIDER=none is all it takes to stop calling out.
  const configured = (env.ADDRESS_LOOKUP_PROVIDER ?? "pdok").trim().toLowerCase();
  if (configured !== "pdok") return null;

  const timeout = Number(env.ADDRESS_LOOKUP_TIMEOUT_MS);

  return new PdokLocatieserverProvider(
    env.ADDRESS_LOOKUP_URL?.trim() || DEFAULT_BASE_URL,
    Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    env.ADDRESS_LOOKUP_CONTACT?.trim() || null,
  );
}

/**
 * Whether autofill exists at all.
 *
 * Rendered on the server and handed to the address form, so with lookup off the
 * browser never makes a request that can only fail — no wasted round trip, and
 * no error in the customer's console.
 */
export function isAddressLookupConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAddressLookupProvider(env) !== null;
}
