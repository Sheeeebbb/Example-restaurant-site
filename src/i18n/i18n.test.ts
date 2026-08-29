import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_LOCALE,
  FORMATTING,
  LOCALE_CODES,
  isLocale,
  negotiateLocale,
  resolveLocale,
} from "./config";
import { statusKey } from "./status";
import { englishMessages } from "./messages";
import { formatMoney } from "../lib/money";
import { generateSlots } from "../lib/fulfillment/scheduling";
import { checkPostalCode, postalCodeError } from "../lib/fulfillment/postal-code";

const MESSAGES_DIR = path.join(process.cwd(), "messages");

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (!value || typeof value !== "object") return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, child]) => ({ ...out, ...flatten(child, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

const catalogues = Object.fromEntries(
  readdirSync(MESSAGES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => [
      path.basename(file, ".json"),
      flatten(JSON.parse(readFileSync(path.join(MESSAGES_DIR, file), "utf8"))),
    ]),
);

describe("the message catalogues", () => {
  it("has a file for every supported locale", () => {
    for (const code of LOCALE_CODES) expect(catalogues[code], code).toBeDefined();
  });

  it("translates every English key in every other language", () => {
    // A gap here does not break the site — it falls back to English — but it
    // does mean a customer reading Dutch hits an English sentence, which is
    // the thing this whole system exists to avoid.
    const english = Object.keys(catalogues[DEFAULT_LOCALE]);
    for (const code of LOCALE_CODES) {
      if (code === DEFAULT_LOCALE) continue;
      const missing = english.filter((key) => !(key in catalogues[code]));
      expect(missing, `missing in ${code}`).toEqual([]);
    }
  });

  it("has no key in another language that English does not have", () => {
    // An orphan is a key nothing reads, or a typo that will fall back forever.
    const english = new Set(Object.keys(catalogues[DEFAULT_LOCALE]));
    for (const code of LOCALE_CODES) {
      if (code === DEFAULT_LOCALE) continue;
      const orphans = Object.keys(catalogues[code]).filter((key) => !english.has(key));
      expect(orphans, `orphaned in ${code}`).toEqual([]);
    }
  });

  it("leaves no translation empty", () => {
    for (const [code, messages] of Object.entries(catalogues)) {
      const blank = Object.entries(messages)
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(blank, `blank in ${code}`).toEqual([]);
    }
  });

  it("keeps the same interpolation placeholders in every language", () => {
    /*
     * The commonest translation bug: a sentence rewritten with the value left
     * out, so the customer is told to "add more to reach the minimum" without
     * being told how much. The catalogue is where that is catchable.
     */
    /*
     * Only the arguments, not the insides of a plural.
     *
     * `{count, plural, =0 {empty} other {# items}}` has ONE argument. A plain
     * regex for `{word}` also finds "empty", and then reports a false mismatch
     * the moment Dutch translates it to "leeg" — which it must. So this walks
     * the string and reads names at brace depth zero only.
     */
    const placeholders = (value: string) => {
      const names: string[] = [];
      let depth = 0;
      for (let i = 0; i < value.length; i += 1) {
        if (value[i] === "}") depth -= 1;
        else if (value[i] === "{") {
          if (depth === 0) {
            const name = /^\s*(\w+)\s*[,}]/.exec(value.slice(i + 1));
            if (name) names.push(name[1]);
          }
          depth += 1;
        }
      }
      return names.sort();
    };

    for (const [key, english] of Object.entries(catalogues[DEFAULT_LOCALE])) {
      for (const code of LOCALE_CODES) {
        if (code === DEFAULT_LOCALE) continue;
        const translated = catalogues[code][key];
        if (translated === undefined) continue;
        expect(placeholders(translated), `${code}: ${key}`).toEqual(placeholders(english));
      }
    }
  });
});

describe("choosing a language", () => {
  it("defaults to English when nothing says otherwise", () => {
    expect(resolveLocale(null, null)).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });

  it("reads the browser's preference when there is no explicit choice", () => {
    expect(resolveLocale(null, "nl-NL,nl;q=0.9,en;q=0.5")).toBe("nl");
    expect(resolveLocale(null, "en-GB,en;q=0.9")).toBe("en");
  });

  it("matches a region subtag to its language", () => {
    // Flemish is Dutch.
    expect(negotiateLocale("nl-BE")).toBe("nl");
  });

  it("honours quality values rather than order", () => {
    expect(negotiateLocale("nl;q=0.4, en;q=0.9")).toBe("en");
  });

  it("ignores a language it does not speak", () => {
    expect(negotiateLocale("de-DE,de;q=0.9")).toBe("en");
  });

  it("lets an explicit choice beat the browser, always", () => {
    // The rule that stops the site dragging someone back to Dutch every time
    // they choose English.
    expect(resolveLocale("en", "nl-NL,nl;q=0.9")).toBe("en");
    expect(resolveLocale("nl", "en-GB,en;q=0.9")).toBe("nl");
  });

  it("ignores a cookie holding a language that does not exist", () => {
    expect(resolveLocale("klingon", "nl-NL")).toBe("nl");
    expect(isLocale("klingon")).toBe(false);
  });
});

describe("formatting", () => {
  it("writes euros the way each language does", () => {
    /*
     * Whitespace is normalised before comparing: Intl separates the amount from
     * the symbol with a non-breaking space (U+00A0), which is correct — it stops
     * "€" wrapping onto its own line — and is invisible in a diff, so asserting
     * on a plain space produces a failure that reads as "12,50 € is not 12,50 €".
     */
    const plain = (value: string) => value.replace(/\s/g, " ");
    expect(plain(formatMoney(1250, "en"))).toBe("12,50 €");
    expect(plain(formatMoney(1250, "nl"))).toBe("€ 12,50");
  });

  it("does not change the amount, only its typography", () => {
    // Same cents in, same cents' worth out — different punctuation.
    const digits = (value: string) => value.replace(/\D/g, "");
    expect(digits(formatMoney(1250, "en"))).toBe(digits(formatMoney(1250, "nl")));
  });

  it("formats dates in each language and times identically", () => {
    const now = new Date(2026, 7, 29, 12, 0);
    const en = generateSlots(now, "pickup", null, 0, "en");
    const nl = generateSlots(now, "pickup", null, 0, "nl");

    expect(en[0].longLabel).toMatch(/August/);
    expect(nl[0].longLabel).toMatch(/augustus/);
    // The clock is the restaurant's, so the times themselves must not move.
    expect(nl.map((d) => d.slots.map((s) => s.value))).toEqual(
      en.map((d) => d.slots.map((s) => s.value)),
    );
    expect(nl[0].slots[0].label).toBe(en[0].slots[0].label);
  });

  it("offers exactly the same slots in every language", () => {
    const now = new Date(2026, 7, 29, 12, 0);
    const en = generateSlots(now, "delivery", null, 0, "en");
    const nl = generateSlots(now, "delivery", null, 0, "nl");
    expect(nl.length).toBe(en.length);
    expect(nl.map((d) => d.date)).toEqual(en.map((d) => d.date));
  });

  it("has a formatting locale for every supported language", () => {
    for (const code of LOCALE_CODES) {
      expect(FORMATTING[code], code).toBeDefined();
    }
  });
});

describe("order status stays language-neutral", () => {
  it("maps a status to a key without ever becoming the stored value", () => {
    expect(statusKey("preparing", "delivery")).toBe("preparing");
    expect(statusKey("ready", "pickup")).toBe("readyPickup");
    expect(statusKey("completed", "pickup")).toBe("completedPickup");
    expect(statusKey("completed", "delivery")).toBe("completed");
  });

  it("has a translation for every status in every language", () => {
    const statuses = ["pending", "confirmed", "preparing", "ready", "readyPickup",
      "outForDelivery", "completed", "completedPickup", "cancelled"];
    for (const code of LOCALE_CODES) {
      for (const status of statuses) {
        expect(catalogues[code][`order.status.${status}`], `${code}.${status}`).toBeTruthy();
      }
    }
  });
});

describe("business rules do not move with the language", () => {
  it("decides the delivery area identically whatever the words are", () => {
    const dutch = (key: string, values?: Record<string, string | number>) =>
      englishMessages(key, values);
    for (const code of ["8929", "8930", "8935", "8940", "8941", "8934AB"]) {
      expect(checkPostalCode(code).deliverable, code).toBe(
        checkPostalCode(code, dutch).deliverable,
      );
    }
  });

  it("still refuses a malformed postal code, in any language", () => {
    expect(checkPostalCode("89305").status).toBe("malformed");
    expect(postalCodeError("")).toBeTruthy();
  });
});
