import { Elysia } from 'elysia';
import { DomainError } from './errors';

export const errorMapping = new Elysia({ name: 'error-mapping' }).onError(
  { as: 'global' },
  ({ code, error, set }) => {
    if (error instanceof DomainError) {
      set.status = error.status;
      return { error: error.message, code: error.code };
    }

    // Elysia answers its own codes (VALIDATION, NOT_FOUND, PARSE) with a sensible status
    // already, so returning nothing hands those back to it.
    if (code !== 'UNKNOWN' && code !== 'INTERNAL_SERVER_ERROR') return;

    console.error(error);
    set.status = 500;
    return { error: 'Internal server error', code: 'internal' as const };
  },
);
