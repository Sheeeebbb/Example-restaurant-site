import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAutofill, type AutofillField } from "./address-autofill";
import {
  PdokLocatieserverProvider,
  getAddressLookupProvider,
  isAddressLookupConfigured,
} from "./address-lookup";

const touched = (...fields: AutofillField[]) => new Set<AutofillField>(fields);
const draft = (street = "", city = "") => ({ street, city });

/**
 * Autofill's only interesting rule is what it refuses to do. A service that
 * overwrites an address someone has typed is worse than no service at all, so
 * that is what these cover.
 */
describe("applyAutofill", () => {
  it("fills empty, untouched fields", () => {
    expect(applyAutofill(draft(), { street: "Rijselstraat", city: "Menen" }, touched()))
      .toEqual({ street: "Rijselstraat", city: "Menen" });
  });

  it("never overwrites a field the customer has typed in", () => {
    expect(
      applyAutofill(draft("My Street", "My Town"), { street: "Rijselstraat", city: "Menen" }, touched()),
    ).toEqual({});
  });

  it("never overwrites a field the customer has touched, even if they emptied it", () => {
    // They deleted the suggestion on purpose. Putting it back is an argument.
    expect(
      applyAutofill(draft("", ""), { city: "Menen" }, touched("city")),
    ).toEqual({});
  });

  it("fills the fields it can and leaves the rest alone", () => {
    expect(
      applyAutofill(draft("", "My Town"), { street: "Rijselstraat", city: "Menen" }, touched("city")),
    ).toEqual({ street: "Rijselstraat" });
  });

  it("treats whitespace as filled-in, not as empty", () => {
    expect(applyAutofill(draft("  ", ""), { street: "Rijselstraat" }, touched())).toEqual({
      street: "Rijselstraat",
    });
  });

  it("does nothing when the service knows nothing", () => {
    expect(applyAutofill(draft(), null, touched())).toEqual({});
    expect(applyAutofill(draft(), {}, touched())).toEqual({});
  });

  it("ignores fields a service returns empty", () => {
    expect(applyAutofill(draft(), { street: "", city: "Menen" }, touched())).toEqual({
      city: "Menen",
    });
  });
});

/** An environment with only the variables a test cares about in it. */
const env = (over: Record<string, string> = {}) => over as unknown as NodeJS.ProcessEnv;

describe("getAddressLookupProvider", () => {
  it("connects PDOK by default, so a fresh deployment has autofill", () => {
    expect(getAddressLookupProvider(env())).toBeInstanceOf(
      PdokLocatieserverProvider,
    );
    expect(isAddressLookupConfigured(env())).toBe(true);
  });

  it("can be switched off entirely", () => {
    const off = env({ ADDRESS_LOOKUP_PROVIDER: "none" });
    expect(getAddressLookupProvider(off)).toBeNull();
    // With this false the form never calls the endpoint at all.
    expect(isAddressLookupConfigured(off)).toBe(false);
  });

  it("treats an unrecognised provider name as off rather than guessing one", () => {
    expect(
      getAddressLookupProvider(env({ ADDRESS_LOOKUP_PROVIDER: "loqate" })),
    ).toBeNull();
  });
});

/**
 * The provider's real job is not fetching — it is refusing to believe what it
 * fetched. Everything below feeds it a response and checks what reaches the
 * customer, because a lookup that returns a confidently wrong street is worse
 * than one that returns nothing.
 */
describe("PdokLocatieserverProvider", () => {
  const doc = (over: Record<string, unknown> = {}) => ({
    postcode: "8934AB",
    straatnaam: "Borniastraat",
    woonplaatsnaam: "Leeuwarden",
    gemeentenaam: "Leeuwarden",
    provincienaam: "Fryslân",
    ...over,
  });

  const respond = (docs: unknown[], init: { ok?: boolean; status?: number } = {}) => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL) => {
      calls.push(String(input));
      return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => ({ response: { docs } }),
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return calls;
  };

  afterEach(() => vi.unstubAllGlobals());

  const provider = () => new PdokLocatieserverProvider();

  it("resolves a full Dutch code to a street, city and municipality", async () => {
    respond([doc()]);
    expect(await provider().lookup("8934", "AB")).toEqual({
      city: "Leeuwarden",
      region: "Fryslân",
      street: "Borniastraat",
    });
  });

  it("names the municipality only when it differs from the city", async () => {
    respond([doc({ woonplaatsnaam: "Wirdum", gemeentenaam: "Leeuwarden" })]);
    const result = await provider().lookup("8934", "AB");
    expect(result).toMatchObject({ city: "Wirdum", municipality: "Leeuwarden" });
  });

  it("fills the town but never a street when the digits cover many streets", async () => {
    // 8934 spans 59 streets in reality. None of them is "the" street.
    const docs = Array.from({ length: 20 }, (_, i) =>
      doc({ postcode: `8934A${i}`, straatnaam: `Street ${i}` }),
    );
    respond(docs);
    const result = await provider().lookup("8934", null);
    expect(result?.city).toBe("Leeuwarden");
    expect(result?.street).toBeUndefined();
    // Twenty is far too many to offer as a menu.
    expect(result?.streetOptions).toBeUndefined();
  });

  it("offers a short menu when the code covers only a few streets", async () => {
    respond([
      doc({ postcode: "8935AA", straatnaam: "Zuiderplein" }),
      doc({ postcode: "8935AB", straatnaam: "Amelandstraat" }),
      doc({ postcode: "8935AC", straatnaam: "Amelandstraat" }),
    ]);
    const result = await provider().lookup("8935", null);
    expect(result?.streetOptions).toEqual(["Amelandstraat", "Zuiderplein"]);
    expect(result?.street).toBeUndefined();
  });

  it("fills a street from the digits alone when every row agrees on one", async () => {
    respond([doc({ postcode: "8936AA" }), doc({ postcode: "8936AB" })]);
    expect((await provider().lookup("8936", null))?.street).toBe("Borniastraat");
  });

  it("fills no city when the code straddles two towns", async () => {
    respond([
      doc({ postcode: "8937AA", woonplaatsnaam: "Leeuwarden" }),
      doc({ postcode: "8937AB", woonplaatsnaam: "Goutum" }),
    ]);
    expect((await provider().lookup("8937", null))?.city).toBeUndefined();
  });

  it("discards rows for a different postal code than the one asked about", async () => {
    respond([doc({ postcode: "1011AB", woonplaatsnaam: "Amsterdam" })]);
    expect(await provider().lookup("8934", "AB")).toBeNull();
  });

  it("answers null for a code the register does not know", async () => {
    respond([]);
    expect(await provider().lookup("8939", "ZZ")).toBeNull();
  });

  it("sends the postal code and nothing else", async () => {
    const calls = respond([doc()]);
    await provider().lookup("8934", "AB");
    const url = new URL(calls[0]);
    expect(url.searchParams.get("q")).toBe("8934AB");
    // No name, no house number, no phone, no order reference.
    expect([...url.searchParams.keys()].sort()).toEqual(["fq", "q", "rows"]);
  });

  it("throws when the service is unwell, so the route can answer 502", async () => {
    respond([], { ok: false, status: 503 });
    await expect(provider().lookup("8934", "AB")).rejects.toThrow(/503/);
  });

  it("gives up rather than hanging when the service is slow", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("TimeoutError")));
      }),
    ));
    await expect(new PdokLocatieserverProvider(undefined, 30).lookup("8934", "AB"))
      .rejects.toThrow();
  });

  it("survives a response shaped nothing like the one documented", async () => {
    for (const body of [null, {}, { response: null }, { response: { docs: "nope" } }]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response),
      );
      expect(await provider().lookup("8934", "AB")).toBeNull();
    }
  });

  it("ignores field values that are not plausible strings", async () => {
    respond([doc({ straatnaam: 42, woonplaatsnaam: "x".repeat(500), gemeentenaam: null })]);
    const result = await provider().lookup("8934", "AB");
    expect(result?.street).toBeUndefined();
    expect(result?.city).toBeUndefined();
    expect(result?.region).toBe("Fryslân");
  });
});
