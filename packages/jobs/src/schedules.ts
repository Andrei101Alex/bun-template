import { logger, reportError } from "@repo/observability";
import { Cron } from "croner";

/** One recurring run. `run` takes the clock the runner read, so the rule it calls needs none. */
export type Schedule = {
  name: string;
  cron: string;
  run: (now: Date) => Promise<void>;
};

/** A handle on what is running: `stop()` ends every schedule, which is what a test needs. */
export type StartedSchedules = { stop: () => void };

/**
 * Starts every schedule on croner, which parses the pattern in its constructor, so a malformed
 * `cron` fails at boot rather than at the first tick that never comes. Patterns are five fields
 * or six with leading seconds.
 */
export function startSchedules(schedules: readonly Schedule[]): StartedSchedules {
  const jobs = schedules.map(start);
  if (jobs.length > 0)
    logger.info({ schedules: schedules.map(({ name }) => name) }, "schedules.started");
  return {
    stop: () => {
      for (const job of jobs) job.stop();
    },
  };
}

// protect: a run still going when the next tick arrives skips that tick rather than overlapping
function start({ name, cron, run }: Schedule): Cron {
  return new Cron(cron, { name, protect: true }, async (job) => {
    // the runner is the edge for a schedule: it reads the clock once and the rule takes it
    const now = job.currentRun() ?? new Date();
    const started = Date.now();
    const line = { schedule: name, now };
    try {
      await run(now);
      logger.info({ ...line, durationMs: Date.now() - started }, "schedule.completed");
    } catch (error) {
      // a throwing schedule must not take the process down; the next tick is its retry
      logger.error({ ...line, durationMs: Date.now() - started }, "schedule.failed");
      reportError(error, line);
    }
  });
}
