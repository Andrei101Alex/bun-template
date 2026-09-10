import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { signUpStaff, signUpUser } from "@repo/auth/testing";
import { pendingMessages } from "@repo/jobs/testing";
import { type App, buildApp } from "../../entrypoints/api/app";

const api = treaty<App>(buildApp());

describe("POST /feedback", () => {
  it("accepts a submission and answers 201 with its id", async () => {
    const { data, error, status } = await api.feedback.post({
      email: "customer@example.com",
      message: "The export button does nothing.",
    });

    expect(error).toBeNull();
    expect(status).toBe(201);
    expect(data?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("enqueues one acknowledgement for the submission it stored", async () => {
    const { data } = await api.feedback.post({
      email: "customer@example.com",
      message: "Acknowledge me.",
    });

    expect(await pendingMessages("feedback.acknowledge")).toEqual([
      { kind: "feedback.acknowledge", payload: { feedbackId: data?.id } },
    ]);
  });

  it("refuses a body that is not a submission", async () => {
    const { error } = await api.feedback.post({ email: "not-an-address", message: "" });

    expect(error?.status).toBe(422);
  });
});

describe("GET /feedback", () => {
  it("refuses an anonymous caller", async () => {
    const { error } = await api.feedback.get();

    expect(error?.status).toBe(401);
    expect(error?.value).toMatchObject({ code: "no_session" });
  });

  it("refuses a signed-in caller who is not staff", async () => {
    const { headers } = await signUpUser();

    const { error } = await api.feedback.get({ headers });

    expect(error?.status).toBe(403);
    expect(error?.value).toMatchObject({ code: "not_staff" });
  });

  it("lists the inbox for staff", async () => {
    await api.feedback.post({ email: "customer@example.com", message: "Listed." });
    const { headers } = await signUpStaff();

    const { data, error } = await api.feedback.get({ headers });

    expect(error).toBeNull();
    expect(data?.map((item) => item.message)).toContain("Listed.");
  });
});
