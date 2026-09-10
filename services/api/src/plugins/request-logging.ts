import { type Logger, logger } from "@repo/observability";
import { Elysia } from "elysia";

// request-id derives this; a plugin never imports a plugin, so the shape is restated rather than
// shared, and buildApp's order is what guarantees it is there
type Traced = { log: Logger };

/** One line per request, through the request's own child logger. */
export const requestLogging = new Elysia({ name: "request-logging" }).onAfterResponse(
  { as: "global" },
  (context) => {
    const { log, request, set } = context as typeof context & Partial<Traced>;
    // a request that matched no route never reached the derive, so it arrives with no child
    const requestLog = log ?? logger.child({ requestId: String(set.headers["x-request-id"]) });
    requestLog.info(
      { method: request.method, path: new URL(request.url).pathname, status: set.status ?? 200 },
      "request",
    );
  },
);
