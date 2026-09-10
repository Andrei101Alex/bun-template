import { defineConfig } from "drizzle-kit";

// Generate only: `bun run --filter @repo/db generate`. Applying is the `migrate` script's job,
// so there are no dbCredentials here and drizzle-kit never opens a connection.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
});
