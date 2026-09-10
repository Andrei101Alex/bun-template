import { defineMessage } from "@repo/jobs";
import { t } from "elysia";

export const postReplyBody = t.Object({
  body: t.String({ minLength: 1, maxLength: 5000 }),
});

export type PostReplyInput = typeof postReplyBody.static;

/** One reply as the rest of the service sees it. */
export type Reply = {
  id: string;
  feedbackId: string;
  body: string;
  createdAt: Date;
};

/** One reply on the wire: timestamps leave as ISO strings, which is what JSON carries. */
export const replyPosted = t.Object({
  id: t.String({ format: "uuid" }),
  feedbackId: t.String({ format: "uuid" }),
  body: t.String(),
  createdAt: t.String({ format: "date-time" }),
});

export type ReplyPosted = typeof replyPosted.static;

/** The one place a stored row becomes the wire shape. */
export const toReplyPosted = (row: Reply): ReplyPosted => ({
  id: row.id,
  feedbackId: row.feedbackId,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
});

/**
 * The refusal the client renders. Declared here rather than answered with `errorBody` so the
 * literal `code` and the `bouncedAt` inside `details` survive into the type Eden Treaty gives
 * the frontends: this is the skeleton's one refusal carrying a value.
 */
export const addressUndeliverable = t.Object({
  code: t.Literal("address_undeliverable"),
  message: t.String(),
  details: t.Object({ bouncedAt: t.String({ format: "date-time" }) }),
});

/**
 * What replies needs of a submission. Structural rather than imported: a feature reaches another
 * feature through its `service.ts` alone, and feedback's returns rows of this shape.
 */
export type Submission = {
  id: string;
  email: string;
  message: string;
  undeliverableAt: Date | null;
  createdAt: Date;
};

/** A submission old enough to be worth the nudge rule, with the replies it has. */
export type NudgeCandidate = { feedback: Submission; replyCount: number };

/**
 * Enqueued in the same transaction as the reply. Only the id travels: the email is built from the
 * stored rows when it is sent, so an edited reply cannot go out in its old wording.
 */
export const deliver = defineMessage(
  "replies.deliver",
  t.Object({ replyId: t.String({ format: "uuid" }) }),
);
