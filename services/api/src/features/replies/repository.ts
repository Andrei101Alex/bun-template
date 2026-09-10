import { db, feedback, replies, type Transaction } from "@repo/db";
import { asc, count, eq, lte } from "drizzle-orm";
import type { NudgeCandidate, Reply } from "./model";

const columns = {
  id: replies.id,
  feedbackId: replies.feedbackId,
  body: replies.body,
  createdAt: replies.createdAt,
};

/** Takes the executor because the reply and its delivery message commit together. */
export async function insertReply(
  tx: Transaction,
  feedbackId: string,
  body: string,
): Promise<Reply> {
  const [row] = await tx.insert(replies).values({ feedbackId, body }).returning(columns);
  // returning() widens to possibly-absent; a one-row insert either returns its row or throws
  return row as Reply;
}

export async function selectReplyById(id: string): Promise<Reply | undefined> {
  const [row] = await db.select(columns).from(replies).where(eq(replies.id, id));
  return row;
}

/**
 * Every submission no newer than the cutoff, each with its reply count. The cutoff is computed by
 * the caller from its `now`; this keeps the scan off rows too recent to qualify and decides
 * nothing else, because `isUnanswered` is the whole rule. The count is a join rather than a call
 * into feedback because only this table can make it.
 */
export async function selectNudgeCandidates(cutoff: Date): Promise<NudgeCandidate[]> {
  const rows = await db
    .select({
      id: feedback.id,
      email: feedback.email,
      message: feedback.message,
      undeliverableAt: feedback.undeliverableAt,
      createdAt: feedback.createdAt,
      replyCount: count(replies.id),
    })
    .from(feedback)
    .leftJoin(replies, eq(replies.feedbackId, feedback.id))
    .where(lte(feedback.createdAt, cutoff))
    .groupBy(feedback.id)
    .orderBy(asc(feedback.createdAt));

  return rows.map(({ replyCount, ...row }) => ({ feedback: row, replyCount }));
}
