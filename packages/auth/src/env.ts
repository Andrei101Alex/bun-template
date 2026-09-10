import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const EnvSchema = Type.Object({
  // signs sessions and cookies; rotating it logs everyone out
  BETTER_AUTH_SECRET: Type.String({ minLength: 1 }),
  // the api's own origin, which is what the auth handler builds callback and cookie URLs from
  BETTER_AUTH_URL: Type.String({ minLength: 1 }),
});

const parsed = Value.Parse(EnvSchema, { ...process.env });

export const env = { secret: parsed.BETTER_AUTH_SECRET, baseURL: parsed.BETTER_AUTH_URL };
