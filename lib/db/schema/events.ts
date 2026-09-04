import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";

import { isEventStaff, isOrganizer } from "./rls";
import { users } from "./users";
import "./triggers";

/**
 * Anything an organizer wants to count attendance for: the main door, each
 * meal, a workshop. Organizers create these freely, so nothing here is
 * hardcoded to the 2026 schedule.
 */
export const events = pgTable(
  "events",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    // What a scanner URL carries, so a lead can text volunteers
    // /checkin/dinner-saturday and every phone lands on the right event.
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    location: text(),

    // Informational, and the list's sort order. Deliberately NOT what decides
    // whether the scanner works — see isActive.
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }),

    // The switch that actually opens and closes a scanner, flipped by hand.
    // Events run late, and a door that stops working at 9:00pm sharp because
    // the clock passed ends_at is worse than one an organizer closes when the
    // line is gone.
    isActive: boolean("is_active").default(true).notNull(),

    createdBy: uuid("created_by"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // An organizer leaving must not delete the event they set up.
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: "events_created_by_fkey",
    }).onDelete("set null"),
    unique("events_slug_unique").on(table.slug),
    pgPolicy("events_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isEventStaff,
    }),
    pgPolicy("events_insert_organizer", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("events_update_organizer", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
    pgPolicy("events_delete_organizer", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

/** How a check-in was made: a scanned QR, or a staffer picking a name. */
export const checkinMethod = pgEnum("checkin_method", ["scan", "manual"]);

/**
 * The attendance record: one row per person per event, and that is the whole
 * point of the table.
 */
export const eventCheckins = pgTable(
  "event_checkins",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    eventId: uuid("event_id").notNull(),
    userId: uuid("user_id").notNull(),
    checkedInAt: timestamp("checked_in_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    // Which staffer let them in. Nullable so removing a volunteer's account
    // does not erase the fact that the hacker was checked in.
    checkedInBy: uuid("checked_in_by"),
    method: checkinMethod().default("scan").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "event_checkins_event_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "event_checkins_user_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.checkedInBy],
      foreignColumns: [users.id],
      name: "event_checkins_checked_in_by_fkey",
    }).onDelete("set null"),

    // The entire duplicate guarantee, and the reason the check-in path inserts
    // with ON CONFLICT rather than reading first. Two volunteers scanning the
    // same badge at the same instant both pass a SELECT; only one can win this.
    unique("event_checkins_event_user_unique").on(table.eventId, table.userId),
    // Rosters and the live counter are always "this event, newest first".
    index("event_checkins_event_time_idx").on(table.eventId, table.checkedInAt),

    pgPolicy("event_checkins_select_own_or_staff", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR ${isEventStaff}`,
    }),
    // Everything the check-in path enforces in TypeScript, restated as the
    // last word. The app inserts as the owner role and never touches this, but
    // a volunteer's JWT can reach PostgREST directly, and "is staff" alone let
    // one write a check-in for anybody — someone who never RSVPed, a row
    // signed with a colleague's name, or an arrival at an event that closed
    // hours ago.
    pgPolicy("event_checkins_insert_staff", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${isEventStaff}
  and ${table.checkedInBy} = ${authUid}
  and public.has_confirmed_rsvp(${table.userId})
  and public.is_event_open(${table.eventId})`,
    }),
    // Reverting a mis-scan is an organizer's call, not a volunteer's. No update
    // policy at all: a check-in is created or removed, never edited.
    pgPolicy("event_checkins_delete_organizer", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

/**
 * Every outcome a scan attempt can record. The failures matter as much as the
 * success — `already_checked_in` is the line-jumping signal, and it is only
 * worth anything if it is written down.
 */
export const eventScanOutcome = pgEnum("event_scan_outcome", [
  "checked_in",
  "already_checked_in",
  "unknown_code",
  "not_accepted",
  "no_rsvp",
  "event_closed",
  "reverted",
]);

/**
 * Append-only audit of every scan attempt, and the idempotency ledger.
 *
 * This is what turns "it said they were already checked in" from a toast that
 * vanished into something an organizer can go and look at.
 */
export const eventScanLog = pgTable(
  "event_scan_log",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    eventId: uuid("event_id").notNull(),
    // Null when the scanned text did not resolve to a user at all.
    userId: uuid("user_id"),
    scannedBy: uuid("scanned_by"),
    outcome: eventScanOutcome().notNull(),

    // Generated by the client once per scan attempt and reused across retries,
    // so a retry over flaky venue wifi replays the original outcome instead of
    // reporting the first attempt's success back as a duplicate. Unique per
    // event, not globally — see the constraint below.
    clientScanId: uuid("client_scan_id"),

    // Only populated when userId is null — otherwise it would just repeat the
    // UUID on every row. A scanner can read arbitrary text, so callers truncate
    // before writing.
    rawCode: text("raw_code"),

    scannedAt: timestamp("scanned_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "event_scan_log_event_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "event_scan_log_user_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.scannedBy],
      foreignColumns: [users.id],
      name: "event_scan_log_scanned_by_fkey",
    }).onDelete("set null"),

    // Scoped to the event, not global. A client id only ever means "this
    // attempt at this door", so scoping it globally made one event's scan
    // collide with another's and replay that event's outcome for this one.
    unique("event_scan_log_event_client_scan_unique").on(
      table.eventId,
      table.clientScanId,
    ),
    index("event_scan_log_event_time_idx").on(table.eventId, table.scannedAt),

    pgPolicy("event_scan_log_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isEventStaff,
    }),
    // Signed with the scanner's own id, for the same reason the check-in row
    // is: an audit trail anyone on staff can attribute to a colleague answers
    // "who let them in" with whoever the writer chose.
    pgPolicy("event_scan_log_insert_staff", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${isEventStaff} and ${table.scannedBy} = ${authUid}`,
    }),
    // No update or delete policy — append-only, the same shape as
    // hacker_application_review_events.
  ],
).enableRLS();

export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventCheckinRow = typeof eventCheckins.$inferSelect;
export type NewEventCheckin = typeof eventCheckins.$inferInsert;
export type EventScanLogRow = typeof eventScanLog.$inferSelect;
export type NewEventScanLog = typeof eventScanLog.$inferInsert;
export type CheckinMethod = (typeof checkinMethod.enumValues)[number];
export type EventScanOutcome = (typeof eventScanOutcome.enumValues)[number];
