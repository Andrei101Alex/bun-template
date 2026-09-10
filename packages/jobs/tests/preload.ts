import { beforeEach } from "bun:test";
import { db, outbox } from "@repo/db";
import { migrateTestDatabase } from "@repo/db/testing";
import { resetReportedErrors } from "@repo/observability/testing";

// `bun test --isolate` gives each file its own process, so this is one in-memory PGlite per file
await migrateTestDatabase();

beforeEach(async () => {
  resetReportedErrors();
  await db.delete(outbox);
});
