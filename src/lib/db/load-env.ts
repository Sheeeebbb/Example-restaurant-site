import { loadEnvConfig } from "@next/env";

/**
 * Loads `.env.local` for code that Next.js is not running.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `next dev` reads `.env.local` itself, so the application finds `DATABASE_URL`
 * without help. The database CLIs do not: `npm run db:migrate` and
 * `npm run db:seed` are plain `tsx` processes, and `drizzle-kit` is its own
 * binary. Without this they see an empty `process.env` and fail with
 * `DatabaseNotConfiguredError` — the same error the site gives when nothing is
 * configured at all, which sends you looking for a second missing setting that
 * does not exist. The README says "copy .env.example to .env.local, then run
 * db:setup", and that sequence has to work.
 *
 * `@next/env` rather than a hand-rolled parser or `--env-file`, because it is
 * the loader Next itself uses: same file precedence (`.env.local` over
 * `.env.development` over `.env`), same expansion rules. The CLI and the
 * running site therefore cannot disagree about which value is in effect, which
 * is the entire point — a migration must run against the database the
 * application will read.
 *
 * It never overwrites a variable already present, so `DATABASE_URL=… npm run
 * db:migrate` and CI secrets still win over the file.
 */
export function loadEnv(): void {
  // Quiet: the loader logs which files it read, and that is worth seeing, but
  // only once per process rather than per import.
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
}
