import type { EmailMessage } from "@repo/email";
import type { Reply, Submission } from "./model";

/** The answer itself, quoting what the customer wrote so the thread reads on its own. */
export const replyToSubmitter = (submission: Submission, reply: Reply): EmailMessage => ({
  to: submission.email,
  subject: "Re: your feedback",
  text: [reply.body, "", "---", "What you sent us:", submission.message].join("\n"),
});

/** One line per submission still waiting, oldest first, so staff can work down the list. */
export const unansweredDigest = (to: string, unanswered: readonly Submission[]): EmailMessage => ({
  to,
  subject: `${unanswered.length} feedback item${unanswered.length === 1 ? "" : "s"} unanswered`,
  text: [
    "These submissions have gone 48 hours without a reply:",
    "",
    ...unanswered.map((item) => `- ${item.createdAt.toISOString()} ${item.email}: ${item.message}`),
  ].join("\n"),
});
