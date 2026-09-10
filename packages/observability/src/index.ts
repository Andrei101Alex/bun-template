import { pino } from "pino";
import { env } from "./env";
import { report } from "./memory";

export type { Logger } from "pino";

export const logger = pino({ level: env.logLevel });

/**
 * Where a fault goes: something broke that no rule accounts for. A refusal is not a fault and is
 * never reported. `context` carries the request id, so a report can be tied to its log lines.
 *
 * This is the seam a Sentry-like vendor would take. None ships, so the report is kept in memory
 * and logged at error level.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  report(error, context);
  logger.error({ ...context, err: error }, "fault");
}
