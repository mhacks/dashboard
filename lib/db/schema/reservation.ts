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
import {
  JUDGE_MAP_COLUMNS,
  JUDGE_MAP_ROWS,
  JUDGE_TABLE_WIDTH,
} from "@/lib/reservation/judge-map";
import {
  DEFAULT_PAIR_SECONDS,
  MAX_PAIR_SECONDS,
  MIN_PAIR_SECONDS,
} from "@/lib/judging/timer";
import { teams } from "./teams";
import { users } from "./users";

/**
 * One row, id `default`. Organizers set the table-reservation window from
 * /admin/teams/reservations. Hackers can claim or move a table only inside
 * the window. A missing row is closed.
 */
export const judgingSettings = pgTable(
  "judging_settings",
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
    mapColumns: integer("map_columns").notNull().default(JUDGE_MAP_COLUMNS),
    mapRows: integer("map_rows").notNull().default(JUDGE_MAP_ROWS),
    // How long a judge gets per pair before /judge moves them to a new one.
    pairSeconds: integer("pair_seconds")
      .notNull()
      .default(DEFAULT_PAIR_SECONDS),
  },
  (table) => [
    check("judging_settings_singleton_check", sql`${table.id} = 'default'`),
    check(
      "judging_settings_window_valid",
      sql`${table.reservationsOpenAt} IS NULL
        OR ${table.reservationsCloseAt} IS NULL
        OR ${table.reservationsCloseAt} > ${table.reservationsOpenAt}`,
    ),
    check(
      "judging_settings_map_columns_range",
      sql`${table.mapColumns} >= 1 AND ${table.mapColumns} <= 40`,
    ),
    check(
      "judging_settings_map_rows_range",
      sql`${table.mapRows} >= 1 AND ${table.mapRows} <= 40`,
    ),
    check(
      "judging_settings_pair_seconds_range",
      sql`${table.pairSeconds} >= ${sql.raw(String(MIN_PAIR_SECONDS))} AND ${table.pairSeconds} <= ${sql.raw(String(MAX_PAIR_SECONDS))}`,
    ),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "judging_settings_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("judging_settings_authenticated_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select public.is_organizer()) OR (select public.has_accepted_reservation_access())`,
    }),
    pgPolicy("judging_settings_organizer_all", {
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
    originX: integer("origin_x").notNull().default(0),
    originY: integer("origin_y").notNull().default(0),
    width: integer("width").notNull().default(JUDGE_TABLE_WIDTH),
    height: integer("height").notNull().default(1),
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
    check(
      "tables_origin_nonnegative",
      sql`${table.originX} >= 0 AND ${table.originY} >= 0`,
    ),
    check(
      "tables_size_positive",
      sql`${table.width} >= 1 AND ${table.height} >= 1`,
    ),
    check(
      "tables_geometry_within_map",
      sql`${table.originX} + ${table.width} <= 40 AND ${table.originY} + ${table.height} <= 40`,
    ),
    pgPolicy("tables_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select public.is_organizer()) OR (select public.has_accepted_reservation_access())`,
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

export type JudgingSettings = typeof judgingSettings.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type ReservationAuditLog = typeof reservationAuditLog.$inferSelect;
