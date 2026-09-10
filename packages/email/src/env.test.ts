import { describe, expect, it } from "bun:test";
import { emailEnv } from "./env";

const SECRET = { EMAIL_WEBHOOK_SECRET: "whsec_test" };

describe("emailEnv", () => {
  it("takes the memory provider with no vendor credentials", () => {
    expect(emailEnv({ ...SECRET, EMAIL_PROVIDER: "memory" })).toEqual({
      provider: "memory",
      webhookSecret: "whsec_test",
    });
  });

  it("refuses a provider it does not have, naming the variable", () => {
    expect(() => emailEnv({ ...SECRET, EMAIL_PROVIDER: "sendgrid" })).toThrow(/EMAIL_PROVIDER/);
    expect(() => emailEnv(SECRET)).toThrow(/EMAIL_PROVIDER/);
  });

  it("requires the webhook secret whichever provider sends", () => {
    expect(() => emailEnv({ EMAIL_PROVIDER: "memory" })).toThrow(/EMAIL_WEBHOOK_SECRET/);
  });

  it("requires the api key and the sender only for resend", () => {
    expect(() => emailEnv({ ...SECRET, EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(() =>
      emailEnv({ ...SECRET, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test" }),
    ).toThrow(/EMAIL_FROM/);
    expect(
      emailEnv({
        ...SECRET,
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "a@b.test",
      }),
    ).toEqual({
      provider: "resend",
      webhookSecret: "whsec_test",
      apiKey: "re_test",
      from: "a@b.test",
    });
  });
});
