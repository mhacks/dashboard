import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { BroadcastFailure } from "@/lib/broadcast/types";
import { users } from "./users";

export const broadcastLogs = pgTable(
  "broadcast_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target").notNull().default("email:hacker"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    sentBy: uuid("sent_by").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("complete"),
    recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
    deliveredTo: jsonb("delivered_to").$type<string[]>().notNull().default([]),
    omittedTo: jsonb("omitted_to").$type<string[]>().notNull().default([]),
    failedCount: integer("failed_count").notNull().default(0),
    nextCursor: integer("next_cursor").notNull().default(0),
    processingRecipient: text("processing_recipient"),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    recentFailures: jsonb("recent_failures")
      .$type<BroadcastFailure[]>()
      .notNull()
      .default([]),
  },
  (table) => [
    uniqueIndex("broadcast_logs_active_target_unique")
      .on(table.target)
      .where(sql`${table.status} = 'sending'`),
  ],
).enableRLS();

export type BroadcastLogRow = typeof broadcastLogs.$inferSelect;
export type NewBroadcastLog = typeof broadcastLogs.$inferInsert;
