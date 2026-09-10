import { isDomainError, type Kind } from "@repo/errors";
import { type Logger, logger } from "@repo/observability";
import { Elysia, t } from "elysia";

/** The one place a kind becomes a status. A service names a kind; nothing else names a status. */
const STATUS: Record<Kind, number> = {
  invalid: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
};

/** Every non-2xx body. `routes.ts` declares each refusal it can answer with this. */
export const errorBody = t.Object({
  code: t.String(),
  message: t.String(),
  details: t.Optional(t.Unknown()),
});

type ErrorBody = typeof errorBody.static;

// request-id derives this; a plugin never imports a plugin, so the shape is restated rather than
// shared, and buildApp's order is what guarantees it is there
type Traced = { log: Logger };

/**
 * The envelope writer: a refusal, a schema failure and a fault all leave as `{ code, message,
 * details? }`, with the request id in `x-request-id` and never in the body. Refusals and schema
 * failures are answers, so they log at warn; a fault is reported by `error-reporting`.
 */
export const errorMapping = new Elysia({ name: "error-mapping" }).onError(
  { as: "global" },
  (context) => {
    const { code, error, set } = context;
    const { log } = context as typeof context & Partial<Traced>;

    // an answer the caller asked for, 503 included: warn, and leave the reporter alone
    const refuse = (status: number, body: ErrorBody) => {
      // a request that matched no route never reached the derive, so it arrives with no child
      const requestLog = log ?? logger.child({ requestId: String(set.headers["x-request-id"]) });
      requestLog.warn({ status, code: body.code }, body.message);
      set.status = status;
      return body;
    };

    if (isDomainError(error)) {
      return refuse(STATUS[error.kind], {
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    switch (code) {
      case "VALIDATION":
        return refuse(422, {
          code: "validation",
          message: "Request failed validation",
          // error.message carries the input back; only the paths that failed leave the process
          details: error.all.map(({ path, message }) => ({ path, message })),
        });
      case "NOT_FOUND":
        return refuse(404, { code: "not_found", message: "No route matches this request" });
      case "PARSE":
        return refuse(400, { code: "unparseable_body", message: "Body could not be parsed" });
    }

    set.status = 500;
    return { code: "internal", message: "Internal server error" };
  },
);
