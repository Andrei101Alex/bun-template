import { describe, expect, it } from "bun:test";
import { db, outbox, withTransaction } from "@repo/db";
import { conflict } from "@repo/errors";
import { reportedErrors } from "@repo/observability/testing";
import { Type } from "@sinclair/typebox";
import { eq } from "drizzle-orm";
import { backoffMs, type Handlers, replayDeadLetter, runOutboxOnce } from "./consumer";
import { enqueue } from "./enqueue";
import { defineMessage, handle } from "./message";

const ping = defineMessage("test.ping", Type.Object({ id: Type.String() }));

const handling = (run: (payload: { id: string }) => Promise<void>): Handlers => ({
  [ping.kind]: handle(ping, run),
});

const succeeds = handling(() => Promise.resolve());
const fails = (error: unknown) =>
  handling(() => {
    throw error;
  });

/** A message already in the outbox, so a test can start from an attempt count or a dead letter. */
async function given(row: { attempts?: number; deadLetteredAt?: Date } = {}): Promise<number> {
  const [written] = await db
    .insert(outbox)
    .values({ kind: ping.kind, payload: { id: "p1" }, ...row })
    .returning({ id: outbox.id });
  if (!written) throw new Error("outbox insert returned no row");
  return written.id;
}

async function stored(id: number) {
  const [row] = await db.select().from(outbox).where(eq(outbox.id, id));
  return row;
}

describe("runOutboxOnce", () => {
  it("claims a due message with a lease and a spent attempt", async () => {
    const id = await given();
    let claimed: Awaited<ReturnType<typeof stored>>;

    // the row is only leased while its handler runs, so this is where the claim is observable
    await runOutboxOnce(
      handling(async ({ id: payloadId }) => {
        expect(payloadId).toBe("p1");
        claimed = await stored(id);
      }),
    );

    expect(claimed?.attempts).toBe(1);
    expect(claimed?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it("delivers what was enqueued and deletes the row", async () => {
    await withTransaction((tx) => enqueue(tx, ping, { id: "enqueued" }));
    const delivered: string[] = [];

    expect(await runOutboxOnce(handling(async ({ id }) => void delivered.push(id)))).toBe(1);

    expect(delivered).toEqual(["enqueued"]);
    expect(await db.select().from(outbox)).toEqual([]);
  });

  it("retries a fault after a backoff and records why", async () => {
    const id = await given();
    const failedAt = Date.now();

    await runOutboxOnce(fails(new TypeError("upstream said no")));

    const row = await stored(id);
    expect(row?.deadLetteredAt).toBeNull();
    expect(row?.lockedUntil).toBeNull();
    expect(row?.availableAt.getTime()).toBeWithin(failedAt, failedAt + 30_000);
    expect(row).toMatchObject({
      errorKind: "fault",
      errorCode: "TypeError",
      errorMessage: "upstream said no",
    });
  });

  it("dead-letters a refusal at once, keeping its kind, code and message", async () => {
    const id = await given();

    await runOutboxOnce(fails(conflict("address_undeliverable", "This address bounced")));

    expect(await stored(id)).toMatchObject({
      attempts: 1,
      deadLetteredAt: expect.any(Date),
      errorKind: "conflict",
      errorCode: "address_undeliverable",
      errorMessage: "This address bounced",
    });
  });

  it("dead-letters and reports the tenth failure", async () => {
    const id = await given({ attempts: 9 });

    await runOutboxOnce(fails(new Error("still down")));

    expect(await stored(id)).toMatchObject({ attempts: 10, deadLetteredAt: expect.any(Date) });
    expect(reportedErrors()).toHaveLength(1);
  });

  it("leaves a dead letter alone", async () => {
    const id = await given({ deadLetteredAt: new Date() });

    expect(await runOutboxOnce(succeeds)).toBe(0);

    expect((await stored(id))?.attempts).toBe(0);
  });
});

describe("replayDeadLetter", () => {
  it("makes a dead letter deliverable again", async () => {
    const id = await given({ deadLetteredAt: new Date() });

    expect(await replayDeadLetter(id)).toBe(true);

    expect(await stored(id)).toMatchObject({
      deadLetteredAt: null,
      errorKind: null,
      errorCode: null,
      errorMessage: null,
    });
    expect(await runOutboxOnce(succeeds)).toBe(1);
  });

  it("reports an id that is not a dead letter", async () => {
    expect(await replayDeadLetter(await given())).toBe(false);
  });
});

describe("backoffMs", () => {
  it("doubles the ceiling each attempt and stops at an hour", () => {
    // full jitter, so the ceiling is what many draws approach rather than what one returns
    const ceiling = (attempts: number) =>
      Math.max(...Array.from({ length: 200 }, () => backoffMs(attempts)));

    expect(ceiling(1)).toBeWithin(27_000, 30_001);
    expect(ceiling(4)).toBeWithin(216_000, 240_001);
    expect(ceiling(12)).toBeWithin(3_240_000, 3_600_001);
  });
});
