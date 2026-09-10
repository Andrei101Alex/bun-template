import { auth, isStaff } from "@repo/auth";
import { forbidden, unauthenticated } from "@repo/errors";
import { Elysia } from "elysia";

/**
 * Guards the staff side of the api. A route that uses it can read `session` off the context and
 * know both that there is one and that it is staff's.
 */
export const staffGuard = new Elysia({ name: "staff-guard" }).derive(
  { as: "scoped" },
  async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw unauthenticated("no_session", "This request carries no session");
    if (!isStaff(session)) throw forbidden("not_staff", "This account is not staff");
    return { session };
  },
);
