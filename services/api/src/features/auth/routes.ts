import { auth } from "@repo/auth";
import { Elysia } from "elysia";

/**
 * Better Auth owns every path under `/auth`: sign-up, sign-in, sessions, two-factor. It answers
 * with its own bodies and statuses rather than this service's envelope, so the mount is all there
 * is to this feature and nothing here shapes a response.
 *
 * A route rather than `.mount`: `mount` strips the prefix the handler matches on, and mounting at
 * the root instead would hand Better Auth every unmatched path and its blank 404 with it.
 * `parse: "none"` leaves the body unread, so the handler gets the request whole.
 */
export const authRoutes = new Elysia().all("/auth/*", ({ request }) => auth.handler(request), {
  parse: "none",
});
