import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { type App, buildApp } from "../entrypoints/api/app";

// the plugin's own instance is never imported: it is mounted by buildApp, and what it does is
// only visible on a response
const api = treaty<App>(buildApp());

describe("request id", () => {
  it("puts one on a response the client asked for nothing", async () => {
    const { response } = await api.health.get();

    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("round-trips the one the client sent", async () => {
    const { response } = await api.health.get({ headers: { "x-request-id": "from-the-client" } });

    expect(response.headers.get("x-request-id")).toBe("from-the-client");
  });

  it("puts one on a refused response too", async () => {
    const { response } = await api.feedback.post({ email: "not-an-address", message: "" });

    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
