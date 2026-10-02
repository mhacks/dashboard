import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { teams } from "./teams";
import { users } from "./users";

/**
 * One row, id `default`. Organizers set the reservation window from
 * /admin/reservations. Hackers can claim or move a table only inside it.
 */
export const reservationSettings = pgTable(
  "reservation_settings",
  {
    id: text().primaryKey().default("default").notNull(),
    reservationsOpenAt: timestamp("reservations_open_at", {
      withTimezone: true,
      mode: "string",
    }),
    reservationsCloseAt: timestamp("reservations_close_at", {
      withTimezone: true,
      mode: "string",
    }),
    updatedByUserId: uuid("updated_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("reservation_settings_singleton_check", sql`${table.id} = 'default'`),
    check(
      "reservation_settings_window_valid",
      sql`${table.reservationsOpenAt} IS NULL
        OR ${table.reservationsCloseAt} IS NULL
        OR ${table.reservationsCloseAt} > ${table.reservationsOpenAt}`,
    ),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "reservation_settings_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("reservation_settings_authenticated_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy("reservation_settings_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull(),
    reservedByTeamId: uuid("reserved_by_team_id").references(() => teams.id, {
      onDelete: "restrict",
    }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
  },
  (table) => [
    unique("tables_number_unique").on(table.number),
    uniqueIndex("tables_team_unique").on(table.reservedByTeamId),
    check("tables_number_positive", sql`${table.number} > 0`),
    check(
      "tables_reservation_timestamp_consistent",
      sql`(${table.reservedByTeamId} IS NULL) =
        (${table.reservedAt} IS NULL)`,
    ),
    pgPolicy("tables_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export const reservationAuditLog = pgTable(
  "reservation_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (audit) => [
    index("reservation_audit_created_at_idx").on(audit.createdAt),
    pgPolicy("reservation_audit_select_organizer", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export type ReservationSettings = typeof reservationSettings.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type ReservationAuditLog = typeof reservationAuditLog.$inferSelect;
