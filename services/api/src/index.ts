import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia, t } from "elysia";

const PORT = Number(process.env.PORT ?? 3001);

export const app = new Elysia()
  .use(
    cors({
      origin: [
        "http://localhost:5173", // dashboard (Vite)
        "http://localhost:3000", // website (Next.js)
      ],
    }),
  )
  .use(swagger({ path: "/docs" }))
  .get("/", () => ({ message: "Acme API is running" }))
  .get("/health", () => ({ status: "ok" as const, uptime: process.uptime() }))
  .get(
    "/greeting/:name",
    ({ params: { name } }) => ({
      greeting: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
    }),
    {
      params: t.Object({
        name: t.String(),
      }),
    },
  )
  .listen(PORT);

console.log(`🦊 Acme API running at http://localhost:${app.server?.port}`);

export type App = typeof app;
