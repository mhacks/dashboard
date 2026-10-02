import { and, asc, desc, eq, sql } from "drizzle-orm";

import { requireEventStaff, requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { personNameSql } from "@/lib/db/person-name";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { eventCheckins, events } from "@/lib/db/schema/events";
import { users } from "@/lib/db/schema/users";

// People, not scans: at an event that allows repeat scans, someone scanned in
// twice is still one attendee.
const checkinCountSql = sql<number>`(
  select count(distinct ${eventCheckins.userId})::int
  from ${eventCheckins}
  where ${eventCheckins.eventId} = ${events.id}
)`;

// Every scan that let someone in. Equal to checkinCountSql at a one-scan
// event; at a meal allowing seconds, this is what the kitchen cares about.
const scanCountSql = sql<number>`(
  select count(*)::int
  from ${eventCheckins}
  where ${eventCheckins.eventId} = ${events.id}
)`;

export type AdminEventSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  requiresRsvp: boolean;
  isCheckIn: boolean;
  maxCheckins: number;
  /** People checked in. */
  checkinCount: number;
  /** Scans that let someone in; above checkinCount only on repeat events. */
  scanCount: number;
};

/**
 * Events newest-first by when they start, with unscheduled ones on top —
 * an event with no start time is usually one just created and about to be run.
 */
const EVENT_ORDER = [
  sql`${events.startsAt} is null desc`,
  desc(events.startsAt),
  asc(events.name),
];

export async function listEventsForAdmin(): Promise<AdminEventSummary[]> {
  await requireOrganizer();

  return db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      description: events.description,
      location: events.location,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      isActive: events.isActive,
      requiresRsvp: events.requiresRsvp,
      isCheckIn: events.isCheckIn,
      maxCheckins: events.maxCheckins,
      checkinCount: checkinCountSql,
      scanCount: scanCountSql,
    })
    .from(events)
    .orderBy(...EVENT_ORDER);
}

export type StaffEventOption = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  startsAt: string | null;
  requiresRsvp: boolean;
  isCheckIn: boolean;
  maxCheckins: number;
  checkinCount: number;
  scanCount: number;
};

/**
 * The events a scanner may be pointed at. Only open ones: a closed event is
 * closed for volunteers too, and listing it would only invite scanning into a
 * night that already ended.
 */
export async function getOpenEventsForStaff(): Promise<StaffEventOption[]> {
  await requireEventStaff();

  return db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      location: events.location,
      startsAt: events.startsAt,
      requiresRsvp: events.requiresRsvp,
      isCheckIn: events.isCheckIn,
      maxCheckins: events.maxCheckins,
      checkinCount: checkinCountSql,
      scanCount: scanCountSql,
    })
    .from(events)
    .where(eq(events.isActive, true))
    .orderBy(...EVENT_ORDER);
}

export type StaffEvent = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  isActive: boolean;
  requiresRsvp: boolean;
  isCheckIn: boolean;
  maxCheckins: number;
};

/** The event a scanner is scanning for. Staff-readable, including closed ones
 *  so the scanner can say "this event is closed" rather than 404. */
export async function getEventForStaff(
  slug: string,
): Promise<StaffEvent | null> {
  await requireEventStaff();

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      location: events.location,
      isActive: events.isActive,
      requiresRsvp: events.requiresRsvp,
      isCheckIn: events.isCheckIn,
      maxCheckins: events.maxCheckins,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

export type EventRosterEntry = {
  userId: string;
  name: string;
  email: string;
  /** Null if the application row is gone; the check-in itself still stands. */
  university: string | null;
  /** From their RSVP; null if the application row is gone. */
  shirtSize: string | null;
  /** When they were first let in. */
  checkedInAt: string;
  /** Their most recent scan — the same as checkedInAt unless they have several. */
  lastScannedAt: string;
  /** How many times they have been scanned in; above 1 only on repeat events. */
  scanCount: number;
  /** How their most recent scan was made. */
  method: "scan" | "manual";
  /** Who made their most recent scan: their name if we have one, else email. */
  checkedInByName: string | null;
};

export type EventRoster = {
  event: AdminEventSummary;
  entries: EventRosterEntry[];
};

/**
 * Everyone checked into one event, one entry per person, most recently scanned
 * first. Organizer-only — a volunteer needs to scan, not to read the guest list.
 */
export async function getEventRoster(
  slug: string,
): Promise<EventRoster | null> {
  await requireOrganizer();

  const eventRows = await db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      description: events.description,
      location: events.location,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      isActive: events.isActive,
      requiresRsvp: events.requiresRsvp,
      isCheckIn: events.isCheckIn,
      maxCheckins: events.maxCheckins,
      checkinCount: checkinCountSql,
      scanCount: scanCountSql,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  const event = eventRows[0];
  if (!event) return null;

  // The staffer who scanned is a user too, so they need their own subquery —
  // joining `users` twice directly would collide with the attendee's row.
  const staff = db.$with("staff").as(
    db
      .select({
        id: users.id,
        label: personNameSql.as("label"),
      })
      .from(users)
      .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id)),
  );

  const scans = await db
    .with(staff)
    .select({
      userId: eventCheckins.userId,
      name: personNameSql,
      email: users.email,
      university: hackerApplicants.university,
      shirtSize: hackerApplicants.shirtSize,
      checkedInAt: eventCheckins.checkedInAt,
      method: eventCheckins.method,
      checkedInByName: staff.label,
    })
    .from(eventCheckins)
    .innerJoin(users, eq(users.id, eventCheckins.userId))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, eventCheckins.userId),
    )
    .leftJoin(staff, eq(staff.id, eventCheckins.checkedInBy))
    .where(eq(eventCheckins.eventId, event.id))
    .orderBy(desc(eventCheckins.checkedInAt));

  // Scans arrive newest first, so the first one seen for a person is their
  // latest and fixes their place in the list; each older one pushes their
  // first check-in further back.
  const byUser = new Map<string, EventRosterEntry>();
  for (const scan of scans) {
    const entry = byUser.get(scan.userId);
    if (entry) {
      entry.checkedInAt = scan.checkedInAt;
      entry.scanCount += 1;
    } else {
      byUser.set(scan.userId, {
        ...scan,
        lastScannedAt: scan.checkedInAt,
        scanCount: 1,
      });
    }
  }

  return { event, entries: [...byUser.values()] };
}

/** Rows for the CSV export, in the same order the roster shows them. */
export async function getEventExportRows(slug: string) {
  const roster = await getEventRoster(slug);
  return roster?.entries ?? [];
}

export type EventCheckinCounts = { people: number; scans: number };

/** Live counts for the scanner's running totals. Staff-readable. */
export async function getEventCheckinCounts(
  eventId: string,
): Promise<EventCheckinCounts> {
  await requireEventStaff();

  const rows = await db
    .select({
      people: sql<number>`count(distinct ${eventCheckins.userId})::int`,
      scans: sql<number>`count(*)::int`,
    })
    .from(eventCheckins)
    .where(and(eq(eventCheckins.eventId, eventId)));

  return rows[0] ?? { people: 0, scans: 0 };
}
