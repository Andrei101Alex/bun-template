import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { reportedErrors } from "@repo/observability/testing";
import { buildApp } from "../entrypoints/api/app";

// no production route faults, so the app gains one; every plugin buildApp mounts is global, so
// the route inherits them
const app = buildApp().get("/fault", () => {
  throw new Error("the disk fell off");
});
const api = treaty<typeof app>(app);

describe("error reporting", () => {
  it("reports a fault once, with the request id of the request that hit it", async () => {
    const { error, response } = await api.fault.get({ headers: { "x-request-id": "the-request" } });

    expect(error?.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("the-request");
    const [fault] = reportedErrors();
    expect(reportedErrors()).toHaveLength(1);
    expect(fault?.context).toEqual({ requestId: "the-request" });
    expect(fault?.error).toHaveProperty("message", "the disk fell off");
  });

  it("leaves a refusal alone", async () => {
    const { error } = await api.feedback.post({ email: "not-an-address", message: "" });

    expect(error?.status).toBe(422);
    expect(reportedErrors()).toBeEmpty();
  });
});
