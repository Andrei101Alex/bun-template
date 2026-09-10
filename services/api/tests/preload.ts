import { beforeEach } from "bun:test";
import { migrateTestDatabase } from "@repo/db/testing";

// `bun test --isolate` gives each file its own process, so this is one in-memory PGlite per file
await migrateTestDatabase();

// The seam every vendor double resets through - resetSentEmails(), the reported-errors handle,
// truncating `outbox`. Nothing ships a double yet, so there is nothing to reset.
beforeEach(() => {});
