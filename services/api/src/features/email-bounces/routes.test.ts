import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { webhookSecret } from "@repo/email";
import { reportedErrors } from "@repo/observability/testing";
import { buildApp } from "../../entrypoints/api/app";
import { findFeedback, submitFeedback } from "../feedback/service";

const app = buildApp();
const BOUNCED_AT = "2026-01-01T09:00:00.000Z";

/** The provider's own signature over the exact bytes it is about to send. */
function sign(body: string) {
  const id = "msg_2Vp5JQ";
  const timestamp = "1700000000";
  const key = Buffer.from(webhookSecret.replace("whsec_", ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
}

/**
 * The raw request, because the signature covers bytes: this is the one test that drives
 * `app.handle` rather than Eden Treaty, which would re-encode the body it signed.
 */
function post(body: string, headers: Record<string, string> = sign(body)) {
  return app.handle(
    new Request("http://localhost/webhooks/email", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    }),
  );
}

const bounce = (to: string) =>
  JSON.stringify({ type: "email.bounced", created_at: BOUNCED_AT, data: { to: [to] } });

describe("POST /webhooks/email", () => {
  it("marks the bounced address undeliverable", async () => {
    const { id } = await submitFeedback({ email: "gone@example.com", message: "Bounce me." });

    const response = await post(bounce("gone@example.com"));

    expect(response.status).toBe(200);
    expect((await findFeedback(id))?.undeliverableAt).toEqual(new Date(BOUNCED_AT));
  });

  it("refuses an event that is not signed with the provider's secret", async () => {
    const body = bounce("forged@example.com");

    const response = await post(body, { ...sign(body), "svix-signature": "v1,AAAA" });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "invalid_signature" });
  });

  it("accepts an event kind it does not handle, leaving the address deliverable", async () => {
    const { id } = await submitFeedback({ email: "fine@example.com", message: "Still fine." });
    const body = JSON.stringify({ type: "email.delivered", data: { to: ["fine@example.com"] } });

    expect((await post(body)).status).toBe(200);
    expect((await findFeedback(id))?.undeliverableAt).toBeNull();
  });

  it("accepts a bounce for an address no submission carries", async () => {
    expect((await post(bounce("stranger@example.com"))).status).toBe(200);
  });

  it("answers 500 and reports the fault when the bounce cannot be recorded", async () => {
    // an address carrying a NUL byte is a value the store refuses, so the write throws where a
    // provider outage would: the route's own failure path with nothing stubbed
    const response = await post(bounce("\u0000@example.com"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "internal" });
    expect(reportedErrors()).toHaveLength(1);
  });
});
