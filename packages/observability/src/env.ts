import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/** pino's own levels, `silent` included, so a test run can turn the log off. */
const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const EnvSchema = Type.Object({
  LOG_LEVEL: Type.Union(
    LEVELS.map((level) => Type.Literal(level)),
    { default: "info" },
  ),
});

const parsed = Value.Parse(EnvSchema, { ...process.env });

export const env = { logLevel: parsed.LOG_LEVEL };
