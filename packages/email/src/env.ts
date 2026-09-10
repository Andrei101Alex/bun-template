/**
 * Which provider `sendEmail` is, with what the real one needs to reach the vendor, and the
 * secret the provider signs its webhooks with. The secret is read whichever provider is sending:
 * the bounce webhook is mounted either way, and a missing secret would leave it refusing every
 * event as forged.
 */
export type EmailEnv = { webhookSecret: string } & (
  | { provider: "memory" }
  | { provider: "resend"; apiKey: string; from: string }
);

/**
 * Reads the provider out of an environment, hand-rolled rather than schema-parsed so every
 * failure names the variable that is wrong. The vendor credentials are read only when the vendor
 * is the one sending, which is what lets a dev run and a test run carry none.
 */
export function emailEnv(source: Record<string, string | undefined>): EmailEnv {
  const webhookSecret = source.EMAIL_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("EMAIL_WEBHOOK_SECRET: required");

  const provider = source.EMAIL_PROVIDER;
  if (provider === "memory") return { provider, webhookSecret };
  if (provider === "resend") {
    return {
      provider,
      webhookSecret,
      apiKey: required(source, "RESEND_API_KEY"),
      from: required(source, "EMAIL_FROM"),
    };
  }
  throw new Error(
    `EMAIL_PROVIDER: expected memory or resend, got ${provider === undefined ? "nothing" : `"${provider}"`}`,
  );
}

function required(source: Record<string, string | undefined>, name: string): string {
  const value = source[name];
  if (!value) throw new Error(`${name}: required when EMAIL_PROVIDER is resend`);
  return value;
}

export const env = emailEnv(process.env);
