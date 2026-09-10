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
