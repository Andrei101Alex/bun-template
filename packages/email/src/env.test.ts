import { describe, expect, it } from "bun:test";
import { emailEnv } from "./env";

describe("emailEnv", () => {
  it("takes the memory provider with no vendor credentials", () => {
    expect(emailEnv({ EMAIL_PROVIDER: "memory" })).toEqual({ provider: "memory" });
  });

  it("refuses a provider it does not have, naming the variable", () => {
    expect(() => emailEnv({ EMAIL_PROVIDER: "sendgrid" })).toThrow(/EMAIL_PROVIDER/);
    expect(() => emailEnv({})).toThrow(/EMAIL_PROVIDER/);
  });

  it("requires the api key and the sender only for resend", () => {
    expect(() => emailEnv({ EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(() => emailEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test" })).toThrow(
      /EMAIL_FROM/,
    );
    expect(
      emailEnv({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test", EMAIL_FROM: "a@b.test" }),
    ).toEqual({ provider: "resend", apiKey: "re_test", from: "a@b.test" });
  });
});
