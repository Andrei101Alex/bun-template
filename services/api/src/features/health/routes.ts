import { Elysia } from "elysia";

/**
 * Liveness. No rules and nothing stored, so this feature is a route file and nothing else -
 * a handlers.ts here would only forward the call.
 */
export const healthRoutes = new Elysia()
  .get("/", () => ({ message: "Acme API is running" }))
  .get("/health", () => ({ status: "ok" as const, uptime: process.uptime() }));
