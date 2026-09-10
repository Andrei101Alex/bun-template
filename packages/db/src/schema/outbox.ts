import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One undelivered message. A feature's `service.ts` inserts here in the same transaction as the
 * row the message is about, and `@repo/jobs` claims, runs and deletes it: success deletes the row,
 * so anything left is either waiting or dead-lettered.
 *
 * `attempts` is bumped by the claim rather than by the outcome, so a consumer that dies mid-handler
 * still counts its try. `locked_until` is the lease: a lapsed one is claimable again.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    errorKind: text("error_kind"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // the claim's only query: due rows, dead letters excluded, so the index skips them too
    index("outbox_available_at_idx")
      .on(table.availableAt)
      .where(sql`${table.deadLetteredAt} is null`),
  ],
);
