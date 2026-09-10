import { beforeEach } from "bun:test";
import { migrateTestDatabase } from "@repo/db/testing";
import { resetSentEmails } from "@repo/email/testing";
import { resetReportedErrors } from "@repo/observability/testing";

// `bun test --isolate` gives each file its own process, so this is one in-memory PGlite per file
await migrateTestDatabase();

// Every vendor double resets here; truncating `outbox` joins these once @repo/jobs lands
beforeEach(() => {
  resetReportedErrors();
  resetSentEmails();
});
