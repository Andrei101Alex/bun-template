import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A submission from the public form. `undeliverableAt` is set when the email provider reports the
 * submitter's address as bounced, which is what stops a reply being sent to it.
 */
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  undeliverableAt: timestamp("undeliverable_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
