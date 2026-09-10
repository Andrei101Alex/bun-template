/**
 * The closed set a refusal picks its status from. A service names a kind and never a status;
 * `plugins/error-mapping.ts` owns the one table that turns a kind into one.
 */
export type Kind =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unavailable";

/**
 * A refusal: a rule, a guard or a missing row saying no. `kind` picks the status, `code` is the
 * feature's own word and what a client branches on, `message` is developer English, and `details`
 * carries whatever the client renders alongside it.
 */
export class DomainError extends Error {
  constructor(
    readonly kind: Kind,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const refusal =
  (kind: Kind) =>
  (code: string, message: string, details?: unknown): DomainError =>
    new DomainError(kind, code, message, details);

/** 422: a rule a schema cannot express. */
export const invalid = refusal("invalid");
/** 401: no session, or a signature that does not check out. */
export const unauthenticated = refusal("unauthenticated");
/** 403: a session that is not allowed this. */
export const forbidden = refusal("forbidden");
/** 404: a row that is not there. */
export const notFound = refusal("not_found");
/** 409: a rule refusing the current state. */
export const conflict = refusal("conflict");
/** 429: too many requests; the caller sets `Retry-After` first. */
export const rateLimited = refusal("rate_limited");
/** 503: a dependency is down. */
export const unavailable = refusal("unavailable");

/** True for a refusal, whatever threw it: the outbox reads this to dead-letter rather than retry. */
export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError;
