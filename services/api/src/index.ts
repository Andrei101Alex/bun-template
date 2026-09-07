import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { greetingRoutes } from "./features/greeting/routes";
import { healthRoutes } from "./features/health/routes";
import { env } from "./shared/env";
import { errorMapping } from "./shared/http";

// Wiring only: middleware, then one `.use` per feature. Routes and rules live under
// src/features/<name>/, so nothing but composition belongs in this file.
export const app = new Elysia()
  .use(cors({ origin: env.corsOrigins }))
  .use(swagger({ path: "/docs" }))
  .use(errorMapping)
  .use(healthRoutes)
  .use(greetingRoutes)
  .listen(env.port);

console.log(`🦊 Acme API running at http://localhost:${app.server?.port}`);

export type App = typeof app;
