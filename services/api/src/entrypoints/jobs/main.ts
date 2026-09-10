import "./env";
import { type JobHandler, type Schedule, startOutboxConsumer, startSchedules } from "@repo/jobs";
import { logger } from "@repo/observability";
import * as feedback from "../../features/feedback/jobs";
import * as replies from "../../features/replies/jobs";

/** What a feature's `jobs.ts` may export, both sides optional: a feature declares what it has. */
type Jobs = { handlers?: Record<string, JobHandler>; schedules?: readonly Schedule[] };

// one entry per feature with a jobs.ts; this is the whole registry
const features: Record<string, Jobs> = { feedback, replies };

/**
 * Merging silently would let a second feature's entry replace the first, so a kind two features
 * both claim fails here with the kind named. A kind nobody handles is caught by
 * `startOutboxConsumer`, which is what knows every kind that was declared.
 */
function merge(): { handlers: Record<string, JobHandler>; schedules: Schedule[] } {
  const handlers: Record<string, JobHandler> = {};
  const schedules: Schedule[] = [];

  for (const [feature, jobs] of Object.entries(features)) {
    for (const [kind, handler] of Object.entries(jobs.handlers ?? {})) {
      if (handlers[kind]) {
        throw new Error(`jobs: ${feature} is the second feature to handle "${kind}"`);
      }
      handlers[kind] = handler;
    }
    schedules.push(...(jobs.schedules ?? []));
  }
  return { handlers, schedules };
}

const { handlers, schedules } = merge();

logger.info({ kinds: Object.keys(handlers), schedules: schedules.length }, "jobs.started");

startSchedules(schedules);
await startOutboxConsumer(handlers);
