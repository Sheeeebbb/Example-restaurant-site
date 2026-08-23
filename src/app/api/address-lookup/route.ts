import { NextResponse } from "next/server";
import { getAddressLookupProvider } from "@/lib/fulfillment/address-lookup";
import { checkPostalCode } from "@/lib/fulfillment/postal-code";

/**
 * Postal code → address suggestion.
 *
 * The browser asks this endpoint rather than a lookup service directly, so the
 * service's credential stays on the server. That is the whole reason this route
 * exists: a keyed API called from a client component ships the key to every
 * visitor.
 *
 * Today no provider is configured, so it answers 501 and the address form fills
 * nothing in — see `lib/fulfillment/address-lookup.ts` for what connecting one
 * involves.
 *
 * Only well-formed, in-area codes are looked up. Refusing the rest here means a
 * paid lookup is never spent on an address we would not deliver to anyway, and
 * the endpoint cannot be walked through the whole numbering plan.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const check = checkPostalCode(searchParams.get("postalCode") ?? "");

  if (!check.deliverable) {
    return NextResponse.json(
      { ok: false, error: check.message ?? "Enter a postal code we deliver to." },
      { status: 400 },
    );
  }

  const provider = getAddressLookupProvider();

  if (!provider) {
    // 501, not 500: nothing has failed. The capability is simply not installed,
    // and the client is expected to carry on with a hand-typed address.
    return NextResponse.json(
      { ok: false, error: "Address lookup is not configured." },
      { status: 501 },
    );
  }

  try {
    const suggestion = await provider.lookup(check.normalized);
    return NextResponse.json({ ok: true, suggestion });
  } catch {
    // A lookup outage must never block an order: the customer types the address.
    return NextResponse.json(
      { ok: false, error: "Address lookup is unavailable." },
      { status: 502 },
    );
  }
}
