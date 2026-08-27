/**
 * What a password has to be — the rule itself, and nothing that can only run on
 * a server.
 *
 * Split out from `password.ts` deliberately. That module hashes, which means it
 * imports `node:crypto`, which means importing it from a client component drags
 * Node's crypto into the browser bundle and breaks the page at runtime. This
 * file has no imports at all, so the form that explains the rule and the route
 * that enforces it can both read the same number — which is the point. A
 * minimum length written in two places is a minimum length that will disagree
 * with itself.
 *
 * Length over composition rules: a passphrase a kitchen can remember beats a
 * shorter one with a symbol in it that ends up on a sticky note by the pass.
 */
export const PASSWORD_RULES = { minLength: 8, maxLength: 200 } as const;

/** Null when acceptable, otherwise the sentence to show whoever typed it. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Use at least ${PASSWORD_RULES.minLength} characters — a short phrase is easier to remember and harder to guess.`;
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    return `Keep it under ${PASSWORD_RULES.maxLength} characters.`;
  }
  return null;
}
