import { describe, expect, it } from "bun:test";
import { markAddressUndeliverable, submitFeedback } from "./service";

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
