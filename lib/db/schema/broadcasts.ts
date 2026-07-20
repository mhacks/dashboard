import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const broadcastLogs = pgTable("broadcast_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  sentBy: uuid("sent_by").references(() => users.id),
  broadcastedToEmail: jsonb("broadcasted_to_email").$type<string[]>().notNull().default([]),
  broadcastedToText: jsonb("broadcasted_to_text").$type<string[]>().notNull().default([]),
}).enableRLS();

export type BroadcastLogRow = typeof broadcastLogs.$inferSelect;
export type NewBroadcastLog = typeof broadcastLogs.$inferInsert;
