import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { signUpStaff } from "@repo/auth/testing";
import { pendingMessages } from "@repo/jobs/testing";
import { type App, buildApp } from "../../entrypoints/api/app";
import { markAddressUndeliverable, submitFeedback } from "../feedback/service";

const api = treaty<App>(buildApp());

const given = async (email = "customer@example.com") =>
  (await submitFeedback({ email, message: "The export button does nothing." })).id;

describe("POST /feedback/:id/replies", () => {
  it("answers 201 and leaves the delivery in the outbox", async () => {
    const id = await given();
    const { headers } = await signUpStaff();

    const { data, error, status } = await api
      .feedback({ id })
      .replies.post({ body: "Fixed in the next release." }, { headers });

    expect(error).toBeNull();
    expect(status).toBe(201);
    expect(data?.body).toBe("Fixed in the next release.");
    expect(await pendingMessages("replies.deliver")).toEqual([
      { kind: "replies.deliver", payload: { replyId: data?.id } },
    ]);
  });

  it("refuses a bounced address with 409 and the bounce date", async () => {
    const bouncedAt = new Date("2026-02-01T00:00:00Z");
    const id = await given("bounced@example.com");
    await markAddressUndeliverable("bounced@example.com", bouncedAt);
    const { headers } = await signUpStaff();

    const { error } = await api
      .feedback({ id })
      .replies.post({ body: "Are you there?" }, { headers });

    expect(error?.status).toBe(409);
    // the union Treaty carries: `code` is the literal, `details.bouncedAt` the value to render
    if (error?.status !== 409) throw new Error("expected the refusal");
    expect(error.value.code).toBe("address_undeliverable");
    // Eden revives an ISO date-time on the way back, so compare instants rather than spellings
    expect(new Date(error.value.details.bouncedAt).getTime()).toBe(bouncedAt.getTime());
    expect(await pendingMessages("replies.deliver")).toEqual([]);
  });

  it("refuses an anonymous caller", async () => {
    const id = await given();

    const { error } = await api.feedback({ id }).replies.post({ body: "Hello?" });

    expect(error?.status).toBe(401);
    expect(error?.value).toMatchObject({ code: "no_session" });
  });
});
