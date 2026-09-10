import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { unavailable } from "@repo/errors";
import { reportedErrors } from "@repo/observability/testing";
import { buildApp } from "../entrypoints/api/app";
import { errorBody } from "./error-mapping";

// no production route faults, and health's probe passes against PGlite, so the app gains a route
// per shape; every plugin buildApp mounts is global, so both inherit them
const app = buildApp()
  .get("/fault", () => {
    throw new Error("the disk fell off");
  })
  .get(
    "/down",
    () => {
      throw unavailable("database_unreachable", "The database probe failed");
    },
    { response: { 503: errorBody } },
  );
const api = treaty<typeof app>(app);

describe("error mapping", () => {
  it("answers a schema failure with the failing paths and none of the input", async () => {
    const { error } = await api.feedback.post({ email: "not-an-address", message: "" });

    expect(error?.status).toBe(422);
    const body = error?.value as unknown as {
      code: string;
      details: { path: string; message: string }[];
    };
    expect(body.code).toBe("validation");
    expect(body.details).toContainEqual({ path: "/email", message: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain("not-an-address");
  });

  it("answers an unknown route with the envelope", async () => {
    const response = await app.handle(new Request("http://localhost/nowhere"));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("answers an unparseable body with the envelope", async () => {
    const response = await app.handle(
      new Request("http://localhost/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "unparseable_body" });
  });

  it("answers a fault with the envelope and reports it once", async () => {
    const { error } = await api.fault.get();

    expect(error?.status).toBe(500);
    expect(error?.value).toEqual({ code: "internal", message: "Internal server error" });
    expect(reportedErrors()).toHaveLength(1);
  });

  it("answers a refusal with its own code and reports nothing", async () => {
    const { error } = await api.down.get();

    expect(error?.status).toBe(503);
    expect(error?.value).toMatchObject({
      code: "database_unreachable",
      message: "The database probe failed",
    });
    expect(reportedErrors()).toBeEmpty();
  });

  it("carries the request id in the header and in no body", async () => {
    const { error, response } = await api.down.get({ headers: { "x-request-id": "the-request" } });

    expect(response.headers.get("x-request-id")).toBe("the-request");
    expect(JSON.stringify(error?.value)).not.toContain("the-request");
  });
});
