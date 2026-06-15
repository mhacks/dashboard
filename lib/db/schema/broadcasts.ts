import { pgEnum, pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const broadcastChannelEnum = pgEnum("broadcast_channel", [
  "email",
  "sms",
  "all",
]);

export const broadcastLogs = pgTable("broadcast_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: broadcastChannelEnum("channel").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  sentBy: uuid("sent_by").references(() => users.id),
});

export type BroadcastLogRow = typeof broadcastLogs.$inferSelect;
export type NewBroadcastLog = typeof broadcastLogs.$inferInsert;
