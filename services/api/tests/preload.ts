import { beforeEach } from "bun:test";
import { migrateTestDatabase } from "@repo/db/testing";
import { resetReportedErrors } from "@repo/observability/testing";

// `bun test --isolate` gives each file its own process, so this is one in-memory PGlite per file
await migrateTestDatabase();

// The seam every vendor double resets through - resetSentEmails(), truncating `outbox`
beforeEach(() => {
  resetReportedErrors();
});
