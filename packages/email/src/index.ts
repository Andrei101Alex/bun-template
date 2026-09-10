import { type EmailEnv, env } from "./env";
import { sendViaMemory } from "./memory";
import type { EmailMessage } from "./message";
import { sendViaResend } from "./resend";

export type { EmailMessage } from "./message";
export { verifyWebhookSignature, type WebhookHeaders } from "./webhook";

/**
 * The one door out of this repo to an email vendor: a feature's `service.ts` imports this and
 * passes it the `EmailMessage` its `emails.ts` built. Which provider answers is settled once at
 * boot by `EMAIL_PROVIDER`, so a test sends through the same import production does.
 */
export const sendEmail = providerFor(env);

function providerFor(config: EmailEnv): (message: EmailMessage) => Promise<void> {
  if (config.provider === "memory") return sendViaMemory;
  return (message) => sendViaResend(message, config);
}
