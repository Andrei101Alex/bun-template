import { afterEach, describe, expect, it } from "bun:test";
import { isDomainError } from "@repo/errors";
import { sendViaResend } from "./resend";

const config = { apiKey: "re_test", from: "Support <support@example.test>" };
const message = { to: "customer@example.test", subject: "Thanks", text: "We have it." };

const realFetch = globalThis.fetch;

function answering(status: number, body = "") {
  globalThis.fetch = (() =>
    Promise.resolve(new Response(body, { status }))) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("sendViaResend", () => {
  it("posts the message and the sender to Resend", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response('{"id":"1"}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendViaResend(message, config);

    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  });

  it("turns a 4xx address rejection into a DomainError", async () => {
    answering(422, '{"message":"Invalid `to` field."}');

    const thrown = await sendViaResend(message, config).catch((error: unknown) => error);

    expect(isDomainError(thrown)).toBe(true);
    expect(isDomainError(thrown) && thrown.code).toBe("email_rejected");
  });

  it("lets a 5xx through so the outbox retries it", async () => {
    answering(503);

    const thrown = await sendViaResend(message, config).catch((error: unknown) => error);

    expect(isDomainError(thrown)).toBe(false);
    expect(thrown).toBeInstanceOf(Error);
  });

  it("lets throttling through so the outbox retries it", async () => {
    answering(429);

    const thrown = await sendViaResend(message, config).catch((error: unknown) => error);

    expect(isDomainError(thrown)).toBe(false);
  });
});
