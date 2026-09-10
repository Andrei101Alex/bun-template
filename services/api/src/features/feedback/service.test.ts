import { describe, expect, it } from "bun:test";
import { sentEmails } from "@repo/email/testing";
import { markAddressUndeliverable, sendAcknowledgement, submitFeedback } from "./service";

describe("markAddressUndeliverable", () => {
  it("marks every submission from the bounced address once", async () => {
    const email = "bounced@example.com";
    await submitFeedback({ email, message: "first" });
    await submitFeedback({ email, message: "second" });

    expect(await markAddressUndeliverable(email, new Date("2026-01-01T00:00:00Z"))).toBe(2);
    expect(await markAddressUndeliverable(email, new Date("2026-01-02T00:00:00Z"))).toBe(0);
  });

  it("marks nothing for an address that never submitted", async () => {
    expect(await markAddressUndeliverable("stranger@example.com", new Date())).toBe(0);
  });
});

describe("sendAcknowledgement", () => {
  it("sends one email quoting the submission", async () => {
    const { id } = await submitFeedback({
      email: "customer@example.com",
      message: "The export button does nothing.",
    });

    await sendAcknowledgement(id);

    expect(sentEmails()).toEqual([
      {
        to: "customer@example.com",
        subject: "We got your feedback",
        text: expect.stringContaining("The export button does nothing."),
      },
    ]);
  });

  it("refuses a submission that is gone, so the message dead-letters", async () => {
    const gone = sendAcknowledgement("00000000-0000-0000-0000-000000000000");

    await expect(gone).rejects.toMatchObject({ kind: "not_found", code: "feedback_not_found" });
  });
});
