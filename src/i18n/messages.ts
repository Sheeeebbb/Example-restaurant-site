import en from "../../messages/en.json";

/**
 * A translator for pure, non-React code.
 *
 * ── The problem this solves ─────────────────────────────────────────────────
 * `validateOrderDraft`, `postalCodeError` and friends are pure functions. They
 * run in the browser for live feedback, on the server before an order is
 * accepted, and in 500-odd tests that assert on their output. They cannot call
 * a React hook, and they must not each grow their own copy of the copy.
 *
 * So they take a translator and default to English. A component passes the
 * active one; the server and the tests pass nothing and get exactly what they
 * got before this file existed. That is what makes this change additive rather
 * than a rewrite of validated logic.
 */

export type Messages = (key: string, values?: Record<string, string | number>) => string;

function lookup(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
    source,
  );
}

/**
 * Substitutes `{name}` placeholders.
 *
 * Deliberately not string concatenation: the whole sentence lives in the
 * catalogue, so a translator can move the amount to wherever Dutch grammar
 * wants it. "Add {shortfall} more" and "Bestel nog voor {shortfall}" put the
 * value in different places, and neither is expressible by gluing fragments.
 */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/** The English translator. The fallback everything else is measured against. */
export const englishMessages: Messages = (key, values) => {
  const value = lookup(en, key.split("."));
  return typeof value === "string" ? interpolate(value, values) : "";
};

/**
 * Wraps a next-intl translator so it satisfies `Messages`.
 *
 * next-intl's `t` is namespaced and typed; this adapts one obtained for the
 * root namespace to the plain (key, values) shape the pure modules take.
 */
export function fromNextIntl(
  t: (key: string, values?: Record<string, string | number>) => string,
): Messages {
  return (key, values) => {
    try {
      return t(key, values);
    } catch {
      return englishMessages(key, values);
    }
  };
}
