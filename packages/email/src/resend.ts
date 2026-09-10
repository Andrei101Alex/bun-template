import { invalid } from "@repo/errors";
import type { EmailMessage } from "./message";

const ENDPOINT = "https://api.resend.com/emails";

/** What Resend needs beyond the message. `index.ts` binds it from the package env. */
export type ResendConfig = { apiKey: string; from: string };

// 401 and 403 are the api key and 429 is throttling, so those retry like a 5xx rather than
// dead-lettering a customer's email over a fault a deploy fixes
const REJECTIONS = [400, 422];

/**
 * Hands one message to Resend over its HTTP api, so nothing here is stateful and the vendor is a
 * single file. A rejection becomes a `DomainError`, which the outbox consumer reads as permanent;
 * every other failure propagates untouched and is retried.
 */
export async function sendViaResend(message: EmailMessage, config: ResendConfig): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (response.ok) return;

  const detail = (await response.text()).slice(0, 500);
  if (REJECTIONS.includes(response.status)) {
    throw invalid("email_rejected", `Resend refused the message: ${detail}`);
  }
  throw new Error(`Resend answered ${response.status}: ${detail}`);
}
