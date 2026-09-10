import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { env } from "./env";
import * as schema from "./schema";

export * from "./schema";

type Schema = typeof schema;

/**
 * The handle a query runs on, with the driver erased. PGlite and Postgres differ only in the
 * result type their session returns, so a repository written against this works on either.
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

/** What `withTransaction` hands its callback, and what a repository takes when it needs one. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type Connection =
  | { driver: "pglite"; db: PgliteDatabase<Schema> }
  | { driver: "postgres"; db: PostgresJsDatabase<Schema> };

/** Each driver has its own migrator, so this keeps the concrete instance beside the erased one. */
function connect(): Connection {
  const { target } = env;
  if (target.driver === "pglite") {
    return { driver: "pglite", db: drizzlePglite({ client: new PGlite(target.dataDir), schema }) };
  }
  return { driver: "postgres", db: drizzlePostgres(target.url, { schema }) };
}

const connection = connect();

export const db: Database = connection.db;

export function withTransaction<T>(run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(run);
}

// fileURLToPath, not .pathname: a clone under a path with a space arrives percent-encoded
const MIGRATIONS = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Applies every migration in `drizzle/`. Run by `bun run --filter @repo/db migrate` and by a test
 * preload, never at boot, so no deploy can change the schema by accident.
 */
export async function migrate(): Promise<void> {
  const config = { migrationsFolder: MIGRATIONS };
  if (connection.driver === "pglite") return migratePglite(connection.db, config);
  return migratePostgres(connection.db, config);
}

/** One round trip, false on any failure. The health route's 503 hangs off this. */
export async function checkConnection(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
