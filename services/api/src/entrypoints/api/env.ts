import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/**
 * Every environment value the api process reads, parsed once at boot so a missing or malformed
 * value fails with its own name rather than on the first request that needs it.
 */
const EnvSchema = Type.Object({
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3001 }),
  // dashboard (Vite) and website (Next.js) in local development
  CORS_ORIGINS: Type.String({ default: "http://localhost:5173,http://localhost:3000" }),
});

// Value.Parse cleans unknown keys, applies defaults, then converts, so PORT arrives a number
const parsed = Value.Parse(EnvSchema, { ...process.env });

export const env = {
  port: parsed.PORT,
  corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
};
