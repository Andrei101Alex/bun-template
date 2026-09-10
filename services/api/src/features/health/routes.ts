import { checkConnection } from "@repo/db";
import { unavailable } from "@repo/errors";
import { Elysia } from "elysia";

/**
 * Liveness and readiness for a load balancer. The probe reads a dependency rather than applying a
 * product rule, so this feature stays routes-only: a service.ts here would only forward the call.
 */
export const healthRoutes = new Elysia()
  .get("/", () => ({ message: "Acme API is running" }))
  .get("/health", async () => {
    if (!(await checkConnection())) throw unavailable("Database unreachable");
    return { status: "ok" as const, uptime: process.uptime() };
  });
