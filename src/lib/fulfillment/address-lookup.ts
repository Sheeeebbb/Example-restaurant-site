/**
 * Address autofill — the seam, not the service.
 *
 * ⚠️  NO LOOKUP SERVICE IS CONNECTED. `getAddressLookupProvider()` returns null,
 * `/api/address-lookup` answers 501, and the form fills nothing in. This file
 * exists so that connecting a real one is a single implementation of
 * `AddressLookupProvider` plus a key in the environment — not a refactor of the
 * checkout.
 *
 * ── Connecting a real provider ──────────────────────────────────────────────
 *   1. Write a class implementing `AddressLookupProvider`.
 *   2. Return it from `getAddressLookupProvider()` when its key is present:
 *
 *        if (process.env.ADDRESS_LOOKUP_KEY) {
 *          return new PostcodeServiceProvider(process.env.ADDRESS_LOOKUP_KEY);
 *        }
 *
 * The key is read HERE and nowhere else, from server code only. This module
 * must never be imported into a client component: the browser reaches the
 * provider through `/api/address-lookup`, which keeps the credential on the
 * server where it belongs. A `NEXT_PUBLIC_` key would be shipped to every
 * visitor and billed to whoever found it.
 *
 * Candidate services, with what each would need — none is called today:
 *   • Belgium/Netherlands (this delivery area): a national postcode dataset, or
 *     a commercial API such as Loqate or PostNL. Both are keyed and paid.
 *   • Google Places / Address Validation — keyed, paid, and its terms restrict
 *     storing the results.
 *   • Nominatim (OpenStreetMap) — free and unkeyed, but its usage policy rules
 *     out per-keystroke autocomplete and it needs a contact header. Usable for
 *     a low-volume city/street guess, not for typeahead.
 * Whichever is chosen, a postal code alone identifies a locality, not a house:
 * expect to fill city (and sometimes street), never the house number.
 */

import type { AddressSuggestion } from "./address-autofill";

export interface AddressLookupProvider {
  /** Resolves a normalised postal code, or null when the service knows nothing about it. */
  lookup(postalCode: string): Promise<AddressSuggestion | null>;
}

/**
 * The active provider, or null when none is configured.
 *
 * Server-only. Callers must handle null rather than assuming a lookup exists —
 * autofill is an accelerator, and every field it would have filled is typed by
 * hand today.
 */
export function getAddressLookupProvider(): AddressLookupProvider | null {
  return null;
}

/**
 * Whether autofill exists at all.
 *
 * Rendered on the server and handed to the address form, so with nothing
 * configured the browser never makes a request that can only fail — no wasted
 * round trip, and no 501 in the customer's console.
 */
export function isAddressLookupConfigured(): boolean {
  return getAddressLookupProvider() !== null;
}
