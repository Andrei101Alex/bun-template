import {
  type FeedbackAccepted,
  type FeedbackItem,
  type SubmitFeedbackInput,
  toFeedbackItem,
} from "./model";
import { insertFeedback, markUndeliverable, selectFeedback } from "./repository";

export async function submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackAccepted> {
  const { id } = await insertFeedback(input);
  return { id };
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
