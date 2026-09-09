import { buildApp } from "./app";
import { env } from "./env";

const app = buildApp().listen(env.port);

console.log(`🦊 Acme API running at http://localhost:${app.server?.port}`);
