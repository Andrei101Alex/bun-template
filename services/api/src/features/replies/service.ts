import { withTransaction } from "@repo/db";
import { sendEmail } from "@repo/email";
import { notFound } from "@repo/errors";
import { enqueue } from "@repo/jobs";
import { findFeedback } from "../feedback/service";
import { replyToSubmitter, unansweredDigest } from "./emails";
import {
  deliver,
  type PostReplyInput,
  type ReplyPosted,
  type Submission,
  toReplyPosted,
} from "./model";
import { insertReply, selectNudgeCandidates, selectReplyById } from "./repository";

/** How long a submission may sit without a reply before the nudge lists it. */
const UNANSWERED_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * A reply that was written, or the refusal that carries the date the address bounced. A union
 * rather than a throw because the client renders that date; `routes.ts` maps it to 409.
 */
export type PostReplyResult =
  | { ok: true; reply: ReplyPosted }
  | { ok: false; reason: "address_undeliverable"; bouncedAt: Date };

/**
 * Answers one submission. The row and its delivery message commit together, so a reply that is
 * stored is a reply that will be sent and one that is not stored leaves no message behind.
 */
export async function postReply(
  feedbackId: string,
  input: PostReplyInput,
): Promise<PostReplyResult> {
  const submission = await findFeedback(feedbackId);
  if (!submission) throw notFound("feedback_not_found", `No feedback ${feedbackId} to reply to`);
  if (submission.undeliverableAt) {
    return { ok: false, reason: "address_undeliverable", bouncedAt: submission.undeliverableAt };
  }

  const reply = await withTransaction(async (tx) => {
    const row = await insertReply(tx, feedbackId, input.body);
    await enqueue(tx, deliver, { replyId: row.id });
    return row;
  });
  return { ok: true, reply: toReplyPosted(reply) };
}

/**
 * Delivers one reply. Called by the outbox handler, so a reply or a submission deleted before the
 * message was delivered refuses rather than retries: a refusal dead-letters.
 */
export async function deliverReply(replyId: string): Promise<void> {
  const reply = await selectReplyById(replyId);
  if (!reply) throw notFound("reply_not_found", `No reply ${replyId} to deliver`);
  const submission = await findFeedback(reply.feedbackId);
  if (!submission) {
    throw notFound("feedback_not_found", `Reply ${replyId} answers a submission that is gone`);
  }
  await sendEmail(replyToSubmitter(submission, reply));
}

/**
 * The nudge rule: an address the provider still delivers to, nobody has answered, and 48 hours
 * gone. Pure, so a test moves time by moving `now` rather than by writing a timestamp.
 */
export function isUnanswered(feedback: Submission, replyCount: number, now: Date): boolean {
  if (feedback.undeliverableAt) return false;
  if (replyCount > 0) return false;
  return now.getTime() - feedback.createdAt.getTime() >= UNANSWERED_AFTER_MS;
}

/**
 * Emails staff one digest of everything still unanswered, and nothing at all when there is
 * nothing to say. The recipient comes from the jobs process, which is the only caller.
 */
export async function nudgeUnanswered(recipient: string, now: Date): Promise<void> {
  const candidates = await selectNudgeCandidates(new Date(now.getTime() - UNANSWERED_AFTER_MS));
  const unanswered = candidates
    .filter(({ feedback, replyCount }) => isUnanswered(feedback, replyCount, now))
    .map(({ feedback }) => feedback);

  if (unanswered.length === 0) return;
  await sendEmail(unansweredDigest(recipient, unanswered));
}
