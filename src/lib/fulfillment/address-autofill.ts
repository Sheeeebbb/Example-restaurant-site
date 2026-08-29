/**
 * The rule autofill follows, on its own so both sides can use it.
 *
 * Kept apart from `address-lookup.ts` deliberately: that module reads the
 * service credential and must never reach the browser, while this is pure and
 * is imported by the address form. Splitting them is what keeps a future API
 * key out of the client bundle.
 */

/** What a lookup can tell us about a postal code. Fields are optional because services differ. */
export interface AddressSuggestion {
  city?: string;
  /**
   * Only some services resolve a street from a postal code alone.
   *
   * With Dutch codes it depends on how much the customer typed: the four
   * digits cover a whole town, so a street only appears once the two letters
   * are there — or when the digits happen to cover a single street.
   */
  street?: string;
  /** Province, state, region — whatever the market calls it. */
  region?: string;
  /**
   * The administrative municipality, where it differs from the city.
   *
   * Shown as confirmation, never written into a field: the order form has no
   * municipality of its own, and inventing one would change what an address
   * means everywhere downstream.
   */
  municipality?: string;
  /**
   * Streets to choose from when the code covers more than one and no single
   * answer is right.
   *
   * Empty or absent when there is nothing to choose — either one street was
   * certain (and is in `street`) or there were far too many to be a menu.
   */
  streetOptions?: string[];
}

/** The fields autofill is allowed to touch. The house number is never one of them. */
export type AutofillField = "street" | "city";

/**
 * Applies a suggestion to what the customer has already got.
 *
 * The rule is that a suggestion never overwrites a person. A field the customer
 * has typed in is theirs — if the service disagrees with them about their own
 * street, the service is wrong. So a value is only filled when the field is
 * both empty and untouched, which also means a lookup arriving late (or a
 * second lookup after they corrected the city) cannot undo their edit.
 *
 * Pure, so the rule is tested rather than inferred from the component.
 */
export function applyAutofill<T extends Record<AutofillField, string>>(
  current: T,
  suggestion: AddressSuggestion | null,
  touched: ReadonlySet<AutofillField>,
): Partial<Record<AutofillField, string>> {
  if (!suggestion) return {};

  const changes: Partial<Record<AutofillField, string>> = {};
  for (const field of ["street", "city"] as const) {
    const value = suggestion[field];
    if (!value) continue;
    if (touched.has(field)) continue;
    if (current[field].trim()) continue;
    changes[field] = value;
  }
  return changes;
}
