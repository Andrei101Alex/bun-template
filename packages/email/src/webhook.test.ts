import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./webhook";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const BODY = JSON.stringify({ type: "email.bounced", data: { to: ["nobody@example.test"] } });

function signed(body: string, secret: string) {
  const id = "msg_2Vp5JQ";
  const timestamp = "1700000000";
  const key = Buffer.from(secret.replace("whsec_", ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return {
    body,
    headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
    secret,
  };
}

describe("verifyWebhookSignature", () => {
  it("accepts the provider's own signature", () => {
    expect(verifyWebhookSignature(signed(BODY, SECRET))).toBe(true);
  });

  it("rejects a body changed after signing", () => {
    const request = signed(BODY, SECRET);

    expect(verifyWebhookSignature({ ...request, body: `${BODY} ` })).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    const request = signed(BODY, "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    expect(verifyWebhookSignature({ ...request, secret: SECRET })).toBe(false);
  });

  it("rejects a request carrying no signature headers", () => {
    expect(verifyWebhookSignature({ body: BODY, headers: {}, secret: SECRET })).toBe(false);
  });
});
