import { describe, expect, it } from "bun:test";
import { sentEmails } from "@repo/email/testing";
import { listFeedback, markAddressUndeliverable, submitFeedback } from "../feedback/service";
import type { Submission } from "./model";
import { deliverReply, isUnanswered, nudgeUnanswered, postReply } from "./service";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-03-01T09:00:00Z");

const submission = (over: Partial<Submission> = {}): Submission => ({
  id: "00000000-0000-0000-0000-000000000001",
  email: "customer@example.com",
  message: "The export button does nothing.",
  undeliverableAt: null,
  createdAt: new Date(NOW.getTime() - 72 * HOUR),
  ...over,
});

/** A submission written 72 hours before `NOW`, which is what the nudge rule calls old enough. */
async function given(email = "customer@example.com") {
  const { id } = await submitFeedback({ email, message: "The export button does nothing." });
  return id;
}

describe("isUnanswered", () => {
  it("lists a deliverable submission nobody has answered in 48 hours", () => {
    expect(isUnanswered(submission(), 0, NOW)).toBe(true);
  });

  it("skips one that has a reply", () => {
    expect(isUnanswered(submission(), 1, NOW)).toBe(false);
  });

  it("skips one whose address bounced", () => {
    expect(isUnanswered(submission({ undeliverableAt: new Date() }), 0, NOW)).toBe(false);
  });

  it("skips one that is still inside the 48 hours", () => {
    const recent = submission({ createdAt: new Date(NOW.getTime() - 47 * HOUR) });

    expect(isUnanswered(recent, 0, NOW)).toBe(false);
    expect(isUnanswered(recent, 0, new Date(NOW.getTime() + HOUR))).toBe(true);
  });
});

describe("nudgeUnanswered", () => {
  it("sends one digest listing only the items still unanswered", async () => {
    await given("waiting@example.com");
    const answered = await given("answered@example.com");
    await given("bounced@example.com");
    await postReply(answered, { body: "Fixed in the next release." });
    await markAddressUndeliverable("bounced@example.com", NOW);
    // every row was written now, so the clock has to move past the 48 hours instead
    const later = new Date(Date.now() + 72 * HOUR);

    await nudgeUnanswered("staff@example.com", later);

    const digest = sentEmails().filter(({ to }) => to === "staff@example.com");
    expect(digest).toHaveLength(1);
    expect(digest[0]?.text).toContain("waiting@example.com");
    expect(digest[0]?.text).not.toContain("answered@example.com");
    expect(digest[0]?.text).not.toContain("bounced@example.com");
  });

  it("sends nothing when everything has been answered", async () => {
    await given();
    // the file's PGlite keeps every row an earlier test wrote, so answer the whole inbox
    for (const item of await listFeedback()) await postReply(item.id, { body: "Fixed." });

    await nudgeUnanswered("staff@example.com", new Date(Date.now() + 72 * HOUR));

    expect(sentEmails().filter(({ to }) => to === "staff@example.com")).toEqual([]);
  });
});

describe("postReply", () => {
  it("refuses an address that has bounced, carrying the bounce date", async () => {
    const id = await given("bounced@example.com");
    const bouncedAt = new Date("2026-02-01T00:00:00Z");
    await markAddressUndeliverable("bounced@example.com", bouncedAt);

    expect(await postReply(id, { body: "Are you there?" })).toEqual({
      ok: false,
      reason: "address_undeliverable",
      bouncedAt,
    });
  });

  it("refuses a submission that is not there", async () => {
    const gone = postReply("00000000-0000-0000-0000-000000000000", { body: "Hello?" });

    await expect(gone).rejects.toMatchObject({ kind: "not_found", code: "feedback_not_found" });
  });
});

describe("deliverReply", () => {
  it("sends one email per run, quoting the submission it answers", async () => {
    const id = await given();
    const posted = await postReply(id, { body: "Fixed in the next release." });
    if (!posted.ok) throw new Error("expected the reply to be written");

    await deliverReply(posted.reply.id);

    expect(sentEmails()).toEqual([
      {
        to: "customer@example.com",
        subject: "Re: your feedback",
        text: expect.stringContaining("Fixed in the next release."),
      },
    ]);
  });

  it("refuses a reply that is gone, so the message dead-letters", async () => {
    const gone = deliverReply("00000000-0000-0000-0000-000000000000");

    await expect(gone).rejects.toMatchObject({ kind: "not_found", code: "reply_not_found" });
  });
});
