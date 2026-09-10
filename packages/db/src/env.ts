import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/** Where the rows live. `dataDir` is PGlite's own: `memory://` or a filesystem path. */
export type DatabaseTarget =
  | { driver: "pglite"; dataDir: string }
  | { driver: "postgres"; url: string };

const EnvSchema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
});

const parsed = Value.Parse(EnvSchema, { ...process.env });

const PGLITE = "pglite://";
const POSTGRES = ["postgres://", "postgresql://"];

/** The url carries the password, so it never reaches the message. */
function targetOf(url: string): DatabaseTarget {
  if (url.startsWith(PGLITE)) {
    const dataDir = url.slice(PGLITE.length);
    return { driver: "pglite", dataDir: dataDir === "memory" ? "memory://" : dataDir };
  }
  if (POSTGRES.some((scheme) => url.startsWith(scheme))) return { driver: "postgres", url };
  throw new Error(
    "DATABASE_URL: unknown scheme. Expected pglite://memory, pglite://<dir>, or postgres://<host>/<database>",
  );
}

export const env = { target: targetOf(parsed.DATABASE_URL) };
