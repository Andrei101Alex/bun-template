import { db, outbox } from "@repo/db";
import { isDomainError } from "@repo/errors";
import { logger, reportError } from "@repo/observability";
import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { declaredKinds, type JobHandler } from "./message";

/** Every kind this process delivers, keyed by kind: what the jobs entry point merges and passes. */
export type Handlers = Record<string, JobHandler>;

const BATCH = 10;
const LEASE_MS = 60_000;
const IDLE_MS = 1_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 3_600_000;
/** The attempt that dead-letters a transient failure instead of retrying it once more. */
const MAX_ATTEMPTS = 10;

type Claimed = { id: number; kind: string; payload: unknown; attempts: number };

// the claim bumps attempts, so a consumer that dies mid-handler still spends a try. `for update
// skip locked` is what lets two consumers poll one table; that race is untested, because PGlite is
// a single connection and a test cannot hold two
async function claim(now: Date): Promise<Claimed[]> {
  const due = db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        isNull(outbox.deadLetteredAt),
        lte(outbox.availableAt, now),
        or(isNull(outbox.lockedUntil), lte(outbox.lockedUntil, now)),
      ),
    )
    .orderBy(asc(outbox.availableAt))
    .limit(BATCH)
    .for("update", { skipLocked: true });

  return db
    .update(outbox)
    .set({
      attempts: sql`${outbox.attempts} + 1`,
      lockedUntil: new Date(now.getTime() + LEASE_MS),
    })
    .where(inArray(outbox.id, due))
    .returning({
      id: outbox.id,
      kind: outbox.kind,
      payload: outbox.payload,
      attempts: outbox.attempts,
    });
}

/** `min(30s * 2^(attempts-1), 1h)` with full jitter: uniform below that ceiling, so a batch that
 * failed together does not come back together. */
export function backoffMs(attempts: number): number {
  return Math.random() * Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}

// a refusal carries the feature's own kind and code; a fault has only its constructor name
function describe(error: unknown) {
  if (isDomainError(error)) {
    return { errorKind: error.kind, errorCode: error.code, errorMessage: error.message };
  }
  return {
    errorKind: "fault",
    errorCode: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

// catches everything: a message that throws must not take its batch or the process down, and the
// row it leaves behind says what happened
async function attempt(row: Claimed, handlers: Handlers): Promise<void> {
  const started = Date.now();
  const line = { messageId: row.id, kind: row.kind, attempt: row.attempts };
  try {
    const handler = handlers[row.kind];
    // an unknown kind retries: this consumer may be older than the deploy that enqueued the row
    if (!handler) throw new Error(`no handler for message kind "${row.kind}"`);
    await handler(row.payload);
    await db.delete(outbox).where(eq(outbox.id, row.id));
    logger.info({ ...line, durationMs: Date.now() - started }, "outbox.completed");
  } catch (error) {
    await fail(row, error, { ...line, durationMs: Date.now() - started });
  }
}

/** A refusal is permanent, so it dead-letters at once; anything else is a blip until the tenth. */
async function fail(row: Claimed, error: unknown, line: Record<string, unknown>): Promise<void> {
  const failure = describe(error);
  const permanent = isDomainError(error);

  if (permanent || row.attempts >= MAX_ATTEMPTS) {
    await db
      .update(outbox)
      .set({ ...failure, deadLetteredAt: new Date(), lockedUntil: null })
      .where(eq(outbox.id, row.id));
    if (permanent) {
      logger.warn({ ...line, ...failure }, "outbox.dead_lettered");
      return;
    }
    logger.error({ ...line, ...failure }, "outbox.dead_lettered");
    reportError(error, line);
    return;
  }

  const availableAt = new Date(Date.now() + backoffMs(row.attempts));
  await db
    .update(outbox)
    .set({ ...failure, availableAt, lockedUntil: null })
    .where(eq(outbox.id, row.id));
  logger.warn({ ...line, ...failure, availableAt }, "outbox.retrying");
}

/**
 * Claims one batch and delivers it, answering how many messages it claimed. The consumer is this
 * in a loop; a test drives it directly so nothing waits on a poll.
 */
export async function runOutboxOnce(handlers: Handlers): Promise<number> {
  const claimed = await claim(new Date());
  for (const row of claimed) await attempt(row, handlers);
  return claimed.length;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls the outbox until `SIGTERM`, then drains. Delivery is at-least-once: the row outlives the
 * handler, so a crash between sending and deleting sends twice and no message is lost.
 *
 * Resolves once draining is done. The batch in flight is awaited for up to the lease, past which
 * its rows are claimable by another consumer anyway and waiting only delays the exit.
 */
export async function startOutboxConsumer(handlers: Handlers): Promise<void> {
  assertEveryKindHandled(handlers);
  let draining = false;
  let lapse = () => {};
  const lease = new Promise<void>((resolve) => {
    lapse = resolve;
  });
  const drain = () => {
    draining = true;
    setTimeout(lapse, LEASE_MS).unref();
  };
  process.once("SIGTERM", drain);

  while (!draining) {
    const claimed = await Promise.race([poll(handlers), lease.then(() => 0)]);
    if (claimed === 0 && !draining) await sleep(IDLE_MS);
  }
}

/**
 * A kind nothing handles would be claimed, retried and dead-lettered rather than delivered, so a
 * process that cannot deliver everything its features declared refuses to start.
 *
 * This sees a kind because importing a feature's `jobs.ts` imports the `model.ts` that declares it.
 */
function assertEveryKindHandled(handlers: Handlers): void {
  const unhandled = declaredKinds().filter((kind) => typeof handlers[kind] !== "function");
  if (unhandled.length > 0) {
    throw new Error(`@repo/jobs: no handler for message kind ${unhandled.map(quoted).join(", ")}`);
  }
}

const quoted = (kind: string) => `"${kind}"`;

/** A claim that fails is the database, not a message: report it and poll again rather than exit. */
async function poll(handlers: Handlers): Promise<number> {
  try {
    return await runOutboxOnce(handlers);
  } catch (error) {
    reportError(error, { at: "outbox.claim" });
    return 0;
  }
}

/**
 * Puts a dead letter back in the queue, clearing the flag and the error columns. `attempts` is
 * kept, so an exhausted message gets one attempt per replay and a cause that is still broken
 * dead-letters it again rather than starting the ten over.
 *
 * False when there is no dead letter under that id, which is what the `replay` script reports.
 */
export async function replayDeadLetter(id: number): Promise<boolean> {
  const replayed = await db
    .update(outbox)
    .set({
      deadLetteredAt: null,
      errorKind: null,
      errorCode: null,
      errorMessage: null,
      availableAt: new Date(),
      lockedUntil: null,
    })
    .where(and(eq(outbox.id, id), isNotNull(outbox.deadLetteredAt)))
    .returning({ id: outbox.id });
  return replayed.length > 0;
}
