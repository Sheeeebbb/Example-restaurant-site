import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /*
     * Three test files talk to a real Postgres and truncate it between tests.
     * Run in parallel they truncate each other's rows mid-test, which surfaces
     * as foreign-key violations inside the seed rather than as anything
     * resembling the actual problem.
     *
     * A schema per worker is the right answer for a suite where this costs real
     * time. It does not here: the whole suite is well under a minute, and most
     * of that is the deliberately slow password hashing.
     */
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
