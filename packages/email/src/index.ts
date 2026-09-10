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

/**
 * What the provider signs its webhooks with, for the route that verifies one. Lives here rather
 * than in the api's own env because the signing scheme is this package's business.
 */
export const webhookSecret = env.webhookSecret;

function providerFor(config: EmailEnv): (message: EmailMessage) => Promise<void> {
  if (config.provider === "memory") return sendViaMemory;
  return (message) => sendViaResend(message, config);
}
