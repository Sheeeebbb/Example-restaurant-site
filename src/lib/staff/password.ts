import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password storage.
 *
 * SERVER ONLY. scrypt from Node's own crypto, so there is no dependency to keep
 * patched and nothing to get wrong in the wiring. It is a memory-hard KDF: the
 * point is not that hashing is slow but that hashing a billion candidates in
 * parallel on a GPU is expensive, which is the attack that matters against a
 * stolen database.
 *
 * What is stored is `scrypt$N$r$p$salt$hash` — the parameters travel with the
 * digest, so raising the cost later does not invalidate existing passwords:
 * old ones keep verifying under the parameters they were written with, and are
 * rewritten on next sign-in. `needsRehash` is how the sign-in path asks.
 *
 * Plaintext passwords are never stored, never logged, and never leave the
 * request that carried them.
 */

/**
 * Cost parameters.
 *
 * N=2^16 with r=8 needs about 64MB and a tenth of a second per hash on a
 * server — enough that guessing at scale is expensive, little enough that a
 * kitchen tablet signing in does not appear to hang.
 *
 * Tests drop to 2^14. Not a weaker system: the digest carries the parameters it
 * was written with, so a test-written hash verifies under test parameters and a
 * production one under production parameters, and `needsRehash` upgrades any
 * digest that turns up below the current floor on the next sign-in.
 */
const PARAMS =
  process.env.NODE_ENV === "test"
    ? ({ N: 16384, r: 8, p: 1 } as const)
    : ({ N: 65536, r: 8, p: 1 } as const);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** scrypt needs roughly 128 * N * r bytes; Node's default cap is below that. */
const MAX_MEMORY = 256 * PARAMS.N * PARAMS.r;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAX_MEMORY,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Checks a password against a stored digest.
 *
 * Compared with `timingSafeEqual`, so the answer takes the same time whether
 * the first byte is wrong or the last. Returns false rather than throwing on a
 * malformed digest: a corrupt row must fail closed, not 500.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltPart, hashPart] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltPart, "base64");
    const expected = Buffer.from(hashPart, "base64");
    const derived = await scrypt(password, salt, expected.length, {
      ...params,
      maxmem: Math.max(MAX_MEMORY, 256 * params.N * params.r),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** True when a digest was written with weaker parameters than we use now. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < PARAMS.N;
}

/**
 * What a password has to be to be accepted.
 *
 * Length over composition rules: a 12-character passphrase a kitchen can
 * remember beats an 8-character one with a symbol in it that ends up on a
 * sticky note by the pass.
 */
export const PASSWORD_RULES = { minLength: 12, maxLength: 200 } as const;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Use at least ${PASSWORD_RULES.minLength} characters — a short phrase is easier to remember and harder to guess.`;
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    return `Keep it under ${PASSWORD_RULES.maxLength} characters.`;
  }
  return null;
}
