import { auth, STAFF_ROLE } from "./index";

/** A signed-in caller, ready to drive: `api.feedback.get({ headers })`. */
export type TestSession = { userId: string; headers: { cookie: string } };

/**
 * Signs a fresh user up through Better Auth's own API and returns their session cookie, so a test
 * gets a real session without writing a row or mocking a module.
 */
export async function signUpUser(): Promise<TestSession> {
  const email = `${crypto.randomUUID()}@example.test`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { name: "Test User", email, password: crypto.randomUUID() },
    returnHeaders: true,
  });
  // getSetCookie gives one Set-Cookie per cookie; a request wants them joined, attributes dropped
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { userId: response.user.id, headers: { cookie } };
}

/**
 * The same, promoted to staff. The role travels through Better Auth's own adapter rather than a
 * drizzle write, so field mapping and hooks are the production ones.
 */
export async function signUpStaff(): Promise<TestSession> {
  const session = await signUpUser();
  // not auth.api.setRole: `role` is input: false at sign-up and setRole needs a caller who is
  // already an admin, so there is no public route to the first one
  const { internalAdapter } = await auth.$context;
  await internalAdapter.updateUser(session.userId, { role: STAFF_ROLE });
  return session;
}
