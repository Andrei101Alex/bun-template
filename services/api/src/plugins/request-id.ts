import { logger } from "@repo/observability";
import { Elysia } from "elysia";

const HEADER = "x-request-id";

/**
 * One id per request, on the response and on every log line the request produces. A client that
 * sends its own keeps it, so an id assigned upstream survives the hop.
 */
export const requestId = new Elysia({ name: "request-id" })
  // onRequest, not the derive: it runs before routing, so a request that matches no route still
  // answers with an id
  .onRequest(({ request, set }) => {
    set.headers[HEADER] = request.headers.get(HEADER) ?? crypto.randomUUID();
  })
  .derive({ as: "global" }, ({ set }) => {
    const requestId = String(set.headers[HEADER]);
    return { requestId, log: logger.child({ requestId }) };
  });
