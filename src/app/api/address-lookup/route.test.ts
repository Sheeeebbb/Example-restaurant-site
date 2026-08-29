import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

/**
 * The endpoint's contract, which the checkout leans on in both directions: it
 * must answer usefully when the provider works, and must never become a reason
 * an order cannot be placed when it does not.
 */
const ask = (postalCode: string, headers: Record<string, string> = {}) =>
  GET(
    new Request(
      `http://localhost/api/address-lookup?postalCode=${encodeURIComponent(postalCode)}`,
      { headers: { "x-forwarded-for": "203.0.113.9", ...headers } },
    ),
  );

const doc = (over: Record<string, unknown> = {}) => ({
  postcode: "8934AB",
  straatnaam: "Borniastraat",
  woonplaatsnaam: "Leeuwarden",
  gemeentenaam: "Leeuwarden",
  provincienaam: "Fryslân",
  ...over,
});

const serves = (docs: unknown[]) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ response: { docs } }) }) as unknown as Response),
  );

const fails = () => vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/address-lookup", () => {
  it("answers a valid Dutch postal code with the address it identifies", async () => {
    serves([doc()]);
    const response = await ask("8934 AB");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      suggestion: { street: "Borniastraat", city: "Leeuwarden", region: "Fryslân" },
    });
  });

  it("reads a code however the customer formatted it", async () => {
    for (const input of ["8934ab", "8934 AB", "8934-ab"]) {
      serves([doc()]);
      const body = await (await ask(input)).json();
      expect(body.suggestion?.street, input).toBe("Borniastraat");
      vi.unstubAllGlobals();
    }
  });

  /**
   * The point of separating the two. Whether we deliver somewhere is decided by
   * `checkPostalCode` in one place; this endpoint's job is only to say what an
   * address is, and it does that for codes we cannot deliver to as well.
   */
  it("looks up a code outside the delivery area just the same", async () => {
    serves([doc({ postcode: "1011AB", woonplaatsnaam: "Amsterdam", provincienaam: "Noord-Holland" })]);
    const response = await ask("1011AB");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.suggestion.city).toBe("Amsterdam");
  });

  it("refuses an incomplete or malformed code without calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const bad of ["", "89", "abcd", "89305"]) {
      expect((await ask(bad)).status, bad).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an absurdly long query before it reaches a regex", async () => {
    expect((await ask("8".repeat(5000))).status).toBe(400);
  });

  it("answers 200 with nothing when the register does not know the code", async () => {
    serves([]);
    const response = await ask("8939ZZ");
    // Not an error: a new street may simply not be in the register yet, and the
    // form's job then is to get out of the way.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, suggestion: null });
  });

  it("answers 502 without leaking the provider's error when the provider fails", async () => {
    fails();
    const response = await ask("8934AB");
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/network/i);
  });

  it("answers 501 when lookup is switched off", async () => {
    vi.stubEnv("ADDRESS_LOOKUP_PROVIDER", "none");
    const response = await ask("8934AB");
    expect(response.status).toBe(501);
  });

  it("returns only the fields the form uses, never the provider's row", async () => {
    serves([doc({ centroide_ll: "POINT(5.8 53.1)", identificatie: "0080300000335831", bron: "BAG" })]);
    const body = await (await ask("8934AB")).json();
    expect(Object.keys(body.suggestion).sort()).toEqual(["city", "region", "street"]);
    expect(JSON.stringify(body)).not.toMatch(/POINT|identificatie|BAG/);
  });

  it("caps how often one caller can spend the public service's capacity", async () => {
    serves([doc()]);
    const from = { "x-forwarded-for": "198.51.100.7" };
    let limited = 0;
    for (let i = 0; i < 80; i += 1) {
      // A distinct code each time, so this is rate limiting rather than caching.
      const response = await GET(
        new Request(`http://localhost/api/address-lookup?postalCode=8934A${i % 26 === 0 ? "A" : "B"}`, {
          headers: from,
        }),
      );
      if (response.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
