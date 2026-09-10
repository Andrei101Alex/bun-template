import { isDomainError } from "@repo/errors";
import { reportError } from "@repo/observability";
import { Elysia } from "elysia";

/** Faults reach the reporter; a refusal and a schema failure are answers, so neither does. */
export const errorReporting = new Elysia({ name: "error-reporting" }).onError(
  { as: "global" },
  (context) => {
    const { code, error } = context;
    if (isDomainError(error)) return;
    if (code !== "UNKNOWN" && code !== "INTERNAL_SERVER_ERROR") return;

    const { requestId } = context as typeof context & { requestId?: string };
    reportError(error, { requestId });
  },
);
