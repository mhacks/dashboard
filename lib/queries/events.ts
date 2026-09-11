import { and, asc, desc, eq, sql } from "drizzle-orm";

import { requireEventStaff, requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { personNameSql } from "@/lib/db/person-name";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { eventCheckins, events } from "@/lib/db/schema/events";
import { users } from "@/lib/db/schema/users";

const checkinCountSql = sql<number>`(
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
  checkinCount: number;
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
      checkinCount: checkinCountSql,
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
  checkinCount: number;
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
      checkinCount: checkinCountSql,
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
  checkedInAt: string;
  method: "scan" | "manual";
  /** Who scanned them: their name if we have one, else their email. */
  checkedInByName: string | null;
};

export type EventRoster = {
  event: AdminEventSummary;
  entries: EventRosterEntry[];
};

/**
 * Everyone checked into one event, newest first. Organizer-only — a volunteer
 * needs to scan, not to read the guest list.
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
      checkinCount: checkinCountSql,
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

  const entries = await db
    .with(staff)
    .select({
      userId: eventCheckins.userId,
      name: personNameSql,
      email: users.email,
      university: hackerApplicants.university,
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

  return { event, entries };
}

/** Rows for the CSV export, in the same order the roster shows them. */
export async function getEventExportRows(slug: string) {
  const roster = await getEventRoster(slug);
  return roster?.entries ?? [];
}

/** Live count for the scanner's running total. Staff-readable. */
export async function getEventCheckinCount(eventId: string): Promise<number> {
  await requireEventStaff();

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventCheckins)
    .where(and(eq(eventCheckins.eventId, eventId)));

  return rows[0]?.count ?? 0;
}
