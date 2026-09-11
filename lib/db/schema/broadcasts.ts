import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
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
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    retryFailedCount: integer("retry_failed_count").notNull().default(0),
    nextCursor: integer("next_cursor").notNull().default(0),
    processingRecipient: text("processing_recipient"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("broadcast_logs_active_target_unique")
      .on(table.target)
      .where(sql`${table.status} = 'sending'`),
    index("broadcast_logs_sent_at_idx").on(table.sentAt),
    index("broadcast_logs_target_sent_at_idx").on(table.target, table.sentAt),
  ],
).enableRLS();

export const broadcastDeliveries = pgTable(
  "broadcast_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    broadcastId: uuid("broadcast_id").notNull(),
    recipient: text("recipient").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    omitted: boolean("omitted").notNull().default(false),
  },
  (table) => [
    foreignKey({
      columns: [table.broadcastId],
      foreignColumns: [broadcastLogs.id],
      name: "broadcast_deliveries_broadcast_id_fkey",
    }).onDelete("cascade"),
    unique("broadcast_deliveries_broadcast_recipient_unique").on(
      table.broadcastId,
      table.recipient,
    ),
    unique("broadcast_deliveries_broadcast_position_unique").on(
      table.broadcastId,
      table.position,
    ),
    index("broadcast_deliveries_broadcast_status_idx").on(
      table.broadcastId,
      table.status,
      table.omitted,
    ),
    pgPolicy("broadcast_deliveries_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("broadcast_deliveries_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("broadcast_deliveries_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type BroadcastLogRow = typeof broadcastLogs.$inferSelect;
export type BroadcastDeliveryRow = typeof broadcastDeliveries.$inferSelect;
