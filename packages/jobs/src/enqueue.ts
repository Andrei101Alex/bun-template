import { outbox, type Transaction } from "@repo/db";
import type { StaticDecode, TSchema } from "@sinclair/typebox";
import { encodePayload, type Message } from "./message";

/**
 * Writes a message into the outbox on `tx`. The executor is required and is a transaction, because
 * the point of the outbox is that the message and the row it is about commit together: a caller
 * that has no transaction to join has nothing to be atomic with.
 *
 * There is no delayed enqueue - a message is due the moment it commits.
 */
export async function enqueue<Schema extends TSchema>(
  tx: Transaction,
  message: Message<Schema>,
  payload: StaticDecode<Schema>,
): Promise<void> {
  await tx.insert(outbox).values({ kind: message.kind, payload: encodePayload(message, payload) });
}
