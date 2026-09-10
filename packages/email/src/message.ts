/**
 * One email, built by a feature's `emails.ts` and handed to `sendEmail`. The sender is deployment
 * config rather than content, so it is not here: `EMAIL_FROM` supplies it.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};
