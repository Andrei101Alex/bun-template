import { env } from "./env";
import { migrate } from "./index";

/**
 * Brings a test's database up to the schema, so tests run the migrations production runs and
 * cannot drift from it. The scheme guard is here rather than in `migrate` because this is the
 * one caller a stray `DATABASE_URL` could point at a real database.
 */
export async function migrateTestDatabase(): Promise<void> {
  if (env.target.driver !== "pglite") {
    throw new Error("DATABASE_URL: a test run needs a pglite:// scheme; see .env.test");
  }
  await migrate();
}
