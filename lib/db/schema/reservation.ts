import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
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
import { RESERVATION_EVENT_STATUSES } from "../../reservation/domain";
import { isOrganizerFn } from "./functions";
import { teams } from "./reservation-teams";
import { users } from "./users";

export { teams };
export type { Team } from "./reservation-teams";

export const reservationEventStatus = pgEnum(
  "reservation_event_status",
  RESERVATION_EVENT_STATUSES,
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    location: text("location"),
    status: reservationEventStatus("status").notNull().default("draft"),
    reservationsOpenAt: timestamp("reservations_open_at", {
      withTimezone: true,
    }),
    reservationsCloseAt: timestamp("reservations_close_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (event) => [
    check(
      "events_reservation_window_valid",
      sql`${event.reservationsOpenAt} IS NULL
        OR ${event.reservationsCloseAt} IS NULL
        OR ${event.reservationsCloseAt} > ${event.reservationsOpenAt}`,
    ),
    index("events_status_starts_at_idx").on(event.status, event.startsAt),
    pgPolicy("events_select_visible_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${isOrganizerFn} OR ${event.status} IN ('open', 'closed')`,
    }),
  ],
).enableRLS();

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    reservedByTeamId: uuid("reserved_by_team_id").references(() => teams.id, {
      onDelete: "restrict",
    }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
  },
  (table) => [
    unique("tables_event_number_unique").on(table.eventId, table.number),
    uniqueIndex("tables_event_team_unique").on(
      table.eventId,
      table.reservedByTeamId,
    ),
    index("tables_event_id_idx").on(table.eventId),
    check("tables_number_positive", sql`${table.number} > 0`),
    check(
      "tables_reservation_timestamp_consistent",
      sql`(${table.reservedByTeamId} IS NULL) =
        (${table.reservedAt} IS NULL)`,
    ),
    pgPolicy("tables_select_visible_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${isOrganizerFn} OR EXISTS (
        SELECT 1 FROM public.events
        WHERE id = ${table.eventId}
          AND status IN ('open', 'closed')
      )`,
    }),
  ],
).enableRLS();

export const reservationAuditLog = pgTable(
  "reservation_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    eventName: text("event_name").notNull(),
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
    index("reservation_audit_event_created_at_idx").on(
      audit.eventId,
      audit.createdAt,
    ),
    index("reservation_audit_created_at_idx").on(audit.createdAt),
    pgPolicy("reservation_audit_select_organizer", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizerFn,
    }),
  ],
).enableRLS();

export type Event = typeof events.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type ReservationAuditLog = typeof reservationAuditLog.$inferSelect;
