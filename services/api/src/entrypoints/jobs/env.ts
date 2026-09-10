import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
// Importing each package the process uses parses that package's env here, so a missing
// DATABASE_URL or a bad EMAIL_PROVIDER fails at boot rather than on the first message claimed.
import "@repo/db";
import "@repo/email";
import "@repo/observability";

/**
 * What the jobs process reads of its own. The polling constants are code, not env; the digest
 * recipient is deployment config, and this is the only process that sends one. The schedule
 * reads it from `process.env` at its edge, because a feature never imports an entry point.
 */
const EnvSchema = Type.Object({
  STAFF_DIGEST_EMAIL: Type.String({ minLength: 3 }),
});

export const env = Value.Parse(EnvSchema, { ...process.env });
