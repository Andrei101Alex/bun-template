import type { FeedbackAccepted, SubmitFeedbackInput } from "./model";
import { insertFeedback, markUndeliverable } from "./repository";

export async function submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackAccepted> {
  const { id } = await insertFeedback(input);
  return { id };
}

/**
 * Stops any further email to an address the provider reported as bounced. Called by the bounce
 * webhook feature; returns how many submissions this bounce newly marked, so a caller can tell an
 * unknown address from a known one.
 */
export function markAddressUndeliverable(email: string, bouncedAt: Date): Promise<number> {
  return markUndeliverable(email, bouncedAt);
}
