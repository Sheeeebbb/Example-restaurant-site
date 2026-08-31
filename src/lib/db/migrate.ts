import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { closeDb, getDb } from "./client";
import { loadEnv } from "./load-env";

/**
 * Applies every migration in `drizzle/` that has not run yet.
 *
 * Drizzle records what it has applied in its own table, so this is idempotent
 * and safe to run on every deploy — which is the point: schema changes reach
 * production the same way code does, rather than as something someone
 * remembers to paste into psql.
 */
export async function runMigrations(): Promise<void> {
  await migrate(getDb(), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}

/** `npm run db:migrate` */
if (process.argv[1]?.endsWith("migrate.ts") || process.env.RUN_MIGRATIONS_CLI) {
  // `tsx` is not Next, so nothing has read .env.local yet.
  loadEnv();
  runMigrations()
    .then(async () => {
      console.log("Migrations applied.");
      await closeDb();
    })
    .catch(async (error) => {
      console.error("Migration failed:", error);
      await closeDb();
      process.exit(1);
    });
}
