import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
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

  it("refuses a body that is not a submission", async () => {
    const { error } = await api.feedback.post({ email: "not-an-address", message: "" });

    expect(error?.status).toBe(422);
  });
});
