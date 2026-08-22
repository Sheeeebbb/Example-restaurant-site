/**
 * Human-facing order references.
 *
 * Format: UT-XXXXX, from an alphabet with I, O, 0 and 1 removed — these get
 * read out over the phone and written on tickets, and those four are the
 * characters people mishear and mistype.
 *
 * Uniqueness here is probabilistic (32^5 ≈ 33 million). That is fine for a
 * prototype whose orders live in one browser session. A real deployment gets
 * uniqueness from a database constraint on the column, with a retry on
 * collision — never from the generator alone.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LENGTH = 5;

export function generateOrderReference(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < LENGTH; i += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `UT-${code}`;
}

/** Accepts what a customer types: lowercase, spaces, a missing prefix. */
export function normalizeOrderReference(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, "");
  const body = cleaned.startsWith("UT") ? cleaned.slice(2) : cleaned;
  return body ? `UT-${body}` : "";
}

export function isValidReferenceShape(reference: string): boolean {
  return new RegExp(`^UT-[${ALPHABET}]{${LENGTH}}$`).test(reference);
}
