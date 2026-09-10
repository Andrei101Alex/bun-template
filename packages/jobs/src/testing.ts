import { db, outbox } from "@repo/db";
import { asc, eq } from "drizzle-orm";

export type PendingMessage = { kind: string; payload: unknown };

/**
 * Every message still in the outbox, oldest first, dead letters included: delivery deletes the
 * row, so whatever is here is undelivered. A test asserts what its subject enqueued through this
 * rather than reading the table itself.
 */
export function pendingMessages(kind?: string): Promise<PendingMessage[]> {
  return db
    .select({ kind: outbox.kind, payload: outbox.payload })
    .from(outbox)
    .where(kind === undefined ? undefined : eq(outbox.kind, kind))
    .orderBy(asc(outbox.id));
}
