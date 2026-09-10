import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { feedbackRoutes } from "../../features/feedback/routes";
import { healthRoutes } from "../../features/health/routes";
import { errorMapping } from "../../plugins/error-mapping";
import { env } from "./env";

/**
 * Composition only: the plugins that run around a request, then one `.use` per feature. Binding
 * a port is `main.ts`'s job, so a test can build the whole app and drive it in process.
 */
export function buildApp() {
  return new Elysia()
    .use(cors({ origin: env.corsOrigins }))
    .use(swagger({ path: "/docs" }))
    .use(errorMapping)
    .use(healthRoutes)
    .use(feedbackRoutes);
}

/** The contract the frontends type Eden Treaty with. */
export type App = ReturnType<typeof buildApp>;
