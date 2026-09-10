import { describe, expect, it } from "bun:test";
import { sendEmail } from "./index";
import { resetSentEmails, sentEmails } from "./testing";

const message = { to: "customer@example.test", subject: "Thanks", text: "We have it." };

describe("the memory provider", () => {
  it("records what sendEmail was given", async () => {
    await sendEmail(message);

    expect(sentEmails()).toEqual([message]);
  });

  it("is emptied by resetSentEmails", async () => {
    await sendEmail(message);
    resetSentEmails();

    expect(sentEmails()).toEqual([]);
  });
});
