import { Elysia, t } from "elysia";
import { greet } from "./handlers";

/**
 * HTTP for the greeting feature. Validate, call one handler, return what it gives back -
 * failures are the error mapping's job, so nothing here names a status code.
 */
export const greetingRoutes = new Elysia({ prefix: "/greeting" }).get(
  "/:name",
  ({ params: { name } }) => greet(name),
  {
    // Shape belongs to the schema, which also feeds /docs. Rules belong to the handler.
    params: t.Object({ name: t.String({ minLength: 1, maxLength: 64 }) }),
  },
);
