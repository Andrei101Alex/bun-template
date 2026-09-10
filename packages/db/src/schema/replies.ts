import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { feedback } from "./feedback";

/**
 * A staff answer to one submission. The row is written and its delivery message enqueued in one
 * transaction, so a reply that exists is a reply that will be sent.
 */
export const replies = pgTable(
  "replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedbackId: uuid("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // the nudge counts replies per submission, which is the only way this table is read in bulk
  (table) => [index("replies_feedback_id_idx").on(table.feedbackId)],
);
