import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Vitest setup: makes `.env.local` reach the persistence tests.
 *
 * ── Why not the loader the CLIs use ─────────────────────────────────────────
 * `@next/env` deliberately ignores `.env.local` when `NODE_ENV` is "test", and
 * Vitest sets exactly that. Next's reasoning is sound — a test run should not
 * silently inherit whatever database you happen to be developing against — so
 * this reads the file itself rather than arguing with that rule.
 *
 * ── Why that is safe here ───────────────────────────────────────────────────
 * These tests truncate every table, so pointing them at the wrong database is
 * the one mistake worth engineering against. Two things prevent it:
 * `testDatabaseUrl()` in test-support.ts reads `TEST_DATABASE_URL`, a
 * different variable from the one the site runs on, and it refuses any
 * database whose name does not contain "test". Reading the file cannot
 * therefore aim the suite at `urban_table`.
 *
 * `process.loadEnvFile` never overwrites a variable that is already set, so an
 * explicit `TEST_DATABASE_URL=… npm test` and CI's own secrets still win.
 */
const envFile = path.join(process.cwd(), ".env.local");

if (existsSync(envFile)) {
  // Node 20.12+. Feature-detected so an older runtime degrades to "set the
  // variable yourself" rather than crashing every test file.
  process.loadEnvFile?.(envFile);
}
