import type { EmailMessage } from "@repo/email";
import type { Feedback } from "./model";

/** What a submitter gets back: their own words quoted, so they can see what arrived. */
export const acknowledgement = (feedback: Feedback): EmailMessage => ({
  to: feedback.email,
  subject: "We got your feedback",
  text: [
    "Thanks for writing in. Someone on the team will read this and reply.",
    "",
    "What you sent us:",
    feedback.message,
  ].join("\n"),
});
