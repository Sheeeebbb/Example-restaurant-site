/**
 * Translating catalogue content that lives in the database.
 *
 * Option groups and options are seeded content with stable, semantic ids —
 * `grp-cook`, `opt-ex-cheese` — that repeat across dishes: every burger shares
 * one `opt-ex-cheese`. Those ids are the translation keys, so fourteen groups
 * and fifty-odd options cover all sixty-five groups and two hundred options on
 * the menu.
 *
 * Keyed by id rather than translated in the database, because the id is the
 * language-neutral thing: a cart line stores `optionId`, an order stores the
 * English name it was bought under, and neither changes when the customer
 * switches language. This only decides which words are painted.
 *
 * A missing key falls back to the English name from the row, the same rule the
 * dish translations use — a half-translated menu is never a blank line.
 *
 * Group descriptions are keyed `<id>__description` rather than `<id>.description`
 * because a dot is next-intl's namespace separator: the dotted form is read as a
 * nested object, never finds the string, and silently falls back to English.
 */
export interface ContentTranslator {
  (key: string): string;
  has: (key: string) => boolean;
}

/** The name for a group or option id, or the English fallback. */
export function translateContent(
  t: ContentTranslator,
  id: string,
  fallback: string,
): string {
  // `has` first: asking for an absent key logs a missing-message warning in
  // development, and an option we have not translated yet is not a defect.
  return t.has(id) ? t(id) || fallback : fallback;
}
