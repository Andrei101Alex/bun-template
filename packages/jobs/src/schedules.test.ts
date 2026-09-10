import { describe, expect, it } from "bun:test";
import { reportedErrors } from "@repo/observability/testing";
import { startSchedules } from "./schedules";

/** Every second, so a test waits about a tick rather than a minute. */
const EVERY_SECOND = "* * * * * *";

/** Starts one schedule and resolves with what the runner passed its first run. */
function firstRun(run: (now: Date) => Promise<void> = () => Promise.resolve()): Promise<Date> {
  return new Promise<Date>((resolve) => {
    const started = startSchedules([
      {
        name: `test-${crypto.randomUUID()}`,
        cron: EVERY_SECOND,
        run: async (now) => {
          started.stop();
          try {
            await run(now);
          } finally {
            resolve(now);
          }
        },
      },
    ]);
  });
}

describe("startSchedules", () => {
  it("runs a schedule with the clock the runner read", async () => {
    const before = Date.now();

    const now = await firstRun();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("reports a run that throws rather than letting it escape", async () => {
    const boom = new Error("digest failed");

    await firstRun(() => Promise.reject(boom));
    // firstRun resolves as the run rejects; the runner's catch reports a turn later
    await Bun.sleep(10);

    expect(reportedErrors().map(({ error }) => error)).toEqual([boom]);
  });

  it("refuses a pattern it cannot parse", () => {
    expect(() =>
      startSchedules([{ name: "bad", cron: "not a cron", run: async () => {} }]),
    ).toThrow();
  });
});
