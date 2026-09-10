/** Which provider `sendEmail` is, with what the real one needs to reach the vendor. */
export type EmailEnv =
  | { provider: "memory" }
  | { provider: "resend"; apiKey: string; from: string };

/**
 * Reads the provider out of an environment, hand-rolled rather than schema-parsed so every
 * failure names the variable that is wrong. The vendor credentials are read only when the vendor
 * is the one sending, which is what lets a dev run and a test run carry none.
 */
export function emailEnv(source: Record<string, string | undefined>): EmailEnv {
  const provider = source.EMAIL_PROVIDER;
  if (provider === "memory") return { provider };
  if (provider === "resend") {
    return {
      provider,
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
