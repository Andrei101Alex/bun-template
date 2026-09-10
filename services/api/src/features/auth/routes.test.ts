import { describe, expect, it } from "bun:test";
import { buildApp } from "../../entrypoints/api/app";

// Better Auth's routes are typed by its own client, not by Eden Treaty, so this drives the app
// with fetch: what is under test is that the mount, the adapter and the auth tables line up.
const app = buildApp();

describe("/auth", () => {
  it("signs a user up and answers with their session", async () => {
    const signUp = await app.handle(
      new Request("http://localhost/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Ada",
          email: "ada@example.test",
          password: "correct-horse-battery-staple",
        }),
      }),
    );
    expect(signUp.status).toBe(200);

    const cookie = signUp.headers.getSetCookie().map((value) => value.split(";")[0]);
    const session = await app.handle(
      new Request("http://localhost/auth/get-session", { headers: { cookie: cookie.join("; ") } }),
    );

    expect(await session.json()).toMatchObject({ user: { email: "ada@example.test" } });
  });
});
