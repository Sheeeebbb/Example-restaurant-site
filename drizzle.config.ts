import type { Config } from "drizzle-kit";

/**
 * Migration generation. Development tooling only — never imported by the app.
 *
 * `drizzle-kit generate` diffs `src/lib/db/schema.ts` against the SQL already
 * in `drizzle/` and writes the difference as a new numbered file. Those files
 * are committed and are what actually runs against production; the schema
 * module is the source they are generated from, not a thing applied directly.
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
} satisfies Config;
