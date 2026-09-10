import { db, feedback } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Feedback, SubmitFeedbackInput } from "./model";

const columns = {
  id: feedback.id,
  email: feedback.email,
  message: feedback.message,
  undeliverableAt: feedback.undeliverableAt,
  createdAt: feedback.createdAt,
};

export async function insertFeedback(input: SubmitFeedbackInput): Promise<Feedback> {
  const [row] = await db.insert(feedback).values(input).returning(columns);
  // returning() widens to possibly-absent; a one-row insert either returns its row or throws
  return row as Feedback;
}

/** Rows already marked keep their first bounce, so a repeat bounce reports nothing marked. */
export async function markUndeliverable(email: string, bouncedAt: Date): Promise<number> {
  const marked = await db
    .update(feedback)
    .set({ undeliverableAt: bouncedAt, updatedAt: bouncedAt })
    .where(and(eq(feedback.email, email), isNull(feedback.undeliverableAt)))
    .returning({ id: feedback.id });
  return marked.length;
}
