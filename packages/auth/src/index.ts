import { db } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { adminAc, defaultRoles } from "better-auth/plugins/admin/access";
import { env } from "./env";

/** The role that may read the inbox. Everyone else signs up as `user`, the plugin's default. */
export const STAFF_ROLE = "staff";

/**
 * The one Better Auth instance. `features/auth/routes.ts` mounts its handler; `plugins/
 * staff-guard.ts` reads a session off it. The adapter takes the schema from `@repo/db`'s own
 * drizzle instance, so the auth tables are the generated ones in `packages/db/src/schema/auth.ts`.
 */
export const auth = betterAuth({
  secret: env.secret,
  baseURL: env.baseURL,
  basePath: "/auth",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    // staff are this app's administrators, so the role carries the admin plugin's own permissions
    admin({ adminRoles: [STAFF_ROLE], roles: { ...defaultRoles, [STAFF_ROLE]: adminAc } }),
    twoFactor(),
  ],
});

/** What `auth.api.getSession` hands back for a signed-in caller: the session row and its user. */
export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * The pure rule behind the staff guard. The admin plugin stores roles as one comma-separated
 * column, so a user with `user,staff` is staff.
 */
export function isStaff(session: AuthSession): boolean {
  return (session.user.role ?? "").split(",").includes(STAFF_ROLE);
}
