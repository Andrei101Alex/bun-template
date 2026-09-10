import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { type App, buildApp } from "../../entrypoints/api/app";

const api = treaty<App>(buildApp());

describe("GET /health", () => {
  it("answers ok with the database up", async () => {
    const { data, error } = await api.health.get();

    expect(error).toBeNull();
    expect(data?.status).toBe("ok");
  });
});
