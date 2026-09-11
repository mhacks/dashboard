import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { BroadcastFailure } from "@/lib/broadcast/types";
import { users } from "./users";

export const broadcastLogs = pgTable("broadcast_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  target: text("target").notNull().default("email:hacker"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("complete"),
  recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
  deliveredTo: jsonb("delivered_to").$type<string[]>().notNull().default([]),
  failedCount: integer("failed_count").notNull().default(0),
  nextCursor: integer("next_cursor").notNull().default(0),
  recentFailures: jsonb("recent_failures")
    .$type<BroadcastFailure[]>()
    .notNull()
    .default([]),
}).enableRLS();

export type BroadcastLogRow = typeof broadcastLogs.$inferSelect;
export type NewBroadcastLog = typeof broadcastLogs.$inferInsert;
