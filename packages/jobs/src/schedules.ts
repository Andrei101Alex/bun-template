import { logger } from "@repo/observability";

/** One recurring run. `run` takes the clock the runner read, so the rule it calls needs none. */
export type Schedule = {
  name: string;
  cron: string;
  run: (now: Date) => Promise<void>;
};

/**
 * Takes the schedules the jobs process declared. Nothing fires yet: no cron runtime is wired, so
 * this only names at boot what is waiting on one.
 */
export function startSchedules(schedules: readonly Schedule[]): void {
  if (schedules.length === 0) return;
  logger.warn({ schedules: schedules.map(({ name }) => name) }, "schedules.no_runtime");
}
