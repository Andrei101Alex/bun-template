import { createHmac, timingSafeEqual } from "node:crypto";

/** Request headers as a route reads them off the request, lowercased. */
export type WebhookHeaders = Record<string, string | undefined>;

const ID = "svix-id";
const TIMESTAMP = "svix-timestamp";
const SIGNATURE = "svix-signature";
const SECRET_PREFIX = "whsec_";

/**
 * True when `body` carries the provider's own signature for `secret`. Resend signs through Svix:
 * the secret is base64 behind a `whsec_` prefix and the signature is an HMAC-SHA256 over
 * `id.timestamp.body`, so a route must hand this the raw body it received and never a re-encoding
 * of the parsed one.
 *
 * Pure - no clock, no env - so a caller owns where the secret comes from. A replay inside the
 * signature's own window is not caught here; recording a bounce is idempotent.
 */
export function verifyWebhookSignature(request: {
  body: string;
  headers: WebhookHeaders;
  secret: string;
}): boolean {
  const id = request.headers[ID];
  const timestamp = request.headers[TIMESTAMP];
  const offered = request.headers[SIGNATURE];
  if (!id || !timestamp || !offered) return false;

  const key = Buffer.from(
    request.secret.startsWith(SECRET_PREFIX)
      ? request.secret.slice(SECRET_PREFIX.length)
      : request.secret,
    "base64",
  );
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${request.body}`).digest();

  // space-separated `v1,<base64>` entries; a rotated secret leaves two for a while
  return offered.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const candidate = Buffer.from(value, "base64");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
