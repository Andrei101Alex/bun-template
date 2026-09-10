import { t } from "elysia";

export const submitFeedbackBody = t.Object({
  email: t.String({ format: "email", maxLength: 320 }),
  message: t.String({ minLength: 1, maxLength: 5000 }),
});

export type SubmitFeedbackInput = typeof submitFeedbackBody.static;

/** The submitter gets an id back and nothing else; the acknowledgement arrives by email. */
export const feedbackAccepted = t.Object({ id: t.String({ format: "uuid" }) });

export type FeedbackAccepted = typeof feedbackAccepted.static;

/** One submission as the rest of the service sees it. */
export type Feedback = {
  id: string;
  email: string;
  message: string;
  undeliverableAt: Date | null;
  createdAt: Date;
};

/** One inbox row as staff reads it: timestamps leave as ISO strings, which is what JSON carries. */
export const feedbackItem = t.Object({
  id: t.String({ format: "uuid" }),
  email: t.String(),
  message: t.String(),
  undeliverableAt: t.Nullable(t.String({ format: "date-time" })),
  createdAt: t.String({ format: "date-time" }),
});

export const feedbackList = t.Array(feedbackItem);

export type FeedbackItem = typeof feedbackItem.static;

/** The one place a stored row becomes the wire shape. */
export const toFeedbackItem = (row: Feedback): FeedbackItem => ({
  id: row.id,
  email: row.email,
  message: row.message,
  undeliverableAt: row.undeliverableAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
