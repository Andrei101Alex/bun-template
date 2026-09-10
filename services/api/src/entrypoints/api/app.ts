import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { authRoutes } from "../../features/auth/routes";
import { feedbackRoutes } from "../../features/feedback/routes";
import { healthRoutes } from "../../features/health/routes";
import { errorBody, errorMapping } from "../../plugins/error-mapping";
import { errorReporting } from "../../plugins/error-reporting";
import { requestId } from "../../plugins/request-id";
import { requestLogging } from "../../plugins/request-logging";
import { env } from "./env";

/**
 * Composition only: the plugins that run around a request, then one `.use` per feature. Binding
 * a port is `main.ts`'s job, so a test can build the whole app and drive it in process.
 */
export function buildApp() {
  // error-reporting sits ahead of error-mapping: the first onError hook to answer ends the chain
  return (
    new Elysia()
      .use(requestId)
      .use(requestLogging)
      .use(errorReporting)
      .use(errorMapping)
      .use(cors({ origin: env.corsOrigins }))
      .use(swagger({ path: "/docs" }))
      // any route can answer these two, so they are declared here rather than in every routes.ts
      .guard({ as: "global", response: { 422: errorBody, 500: errorBody } })
      .use(healthRoutes)
      .use(authRoutes)
      .use(feedbackRoutes)
  );
}

/** The contract the frontends type Eden Treaty with. */
export type App = ReturnType<typeof buildApp>;
