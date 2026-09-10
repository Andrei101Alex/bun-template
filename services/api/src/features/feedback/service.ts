import { withTransaction } from "@repo/db";
import { sendEmail } from "@repo/email";
import { notFound } from "@repo/errors";
import { enqueue } from "@repo/jobs";
import { acknowledgement } from "./emails";
import {
  acknowledge,
  type FeedbackAccepted,
  type FeedbackItem,
  type SubmitFeedbackInput,
  toFeedbackItem,
} from "./model";
import {
  insertFeedback,
  markUndeliverable,
  selectFeedback,
  selectFeedbackById,
} from "./repository";

/**
 * One transaction, so a submission that is stored is a submission that will be acknowledged and
 * one that is not stored leaves no message behind.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackAccepted> {
  const id = await withTransaction(async (tx) => {
    const row = await insertFeedback(tx, input);
    await enqueue(tx, acknowledge, { feedbackId: row.id });
    return row.id;
  });
  return { id };
}

/**
 * Delivers the acknowledgement for one submission. Called by the outbox handler, so a submission
 * deleted before its message was delivered refuses rather than retries: a refusal dead-letters.
 */
export async function sendAcknowledgement(feedbackId: string): Promise<void> {
  const row = await selectFeedbackById(feedbackId);
  if (!row) throw notFound("feedback_not_found", `No feedback ${feedbackId} to acknowledge`);
  await sendEmail(acknowledgement(row));
}

/** The whole inbox, newest first. `plugins/staff-guard.ts` is what keeps this staff-only. */
export async function listFeedback(): Promise<FeedbackItem[]> {
  return (await selectFeedback()).map(toFeedbackItem);
}

/**
 * Stops any further email to an address the provider reported as bounced. Called by the bounce
 * webhook feature; returns how many submissions this bounce newly marked, so a caller can tell an
 * unknown address from a known one.
 */
export function markAddressUndeliverable(email: string, bouncedAt: Date): Promise<number> {
  return markUndeliverable(email, bouncedAt);
}
