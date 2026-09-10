import { migrate } from "../src/index";

await migrate();
console.log("@repo/db: migrations applied");
// the Postgres driver holds its socket open, so exit rather than wait on it
process.exit(0);
