export type ErrorCode = "invalid_input" | "not_found" | "forbidden" | "conflict" | "unavailable";

const statuses: Record<ErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  unavailable: 503,
};

/**
 * A refusal: a rule, a guard or a missing row saying no. A service throws one and says nothing
 * about HTTP; the api maps the code to a status once, in `plugins/error-mapping.ts`.
 */
export class DomainError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
    this.status = statuses[code];
  }
}

export const invalidInput = (message: string) => new DomainError("invalid_input", message);
export const notFound = (message: string) => new DomainError("not_found", message);
export const forbidden = (message: string) => new DomainError("forbidden", message);
export const conflict = (message: string) => new DomainError("conflict", message);
export const unavailable = (message: string) => new DomainError("unavailable", message);
