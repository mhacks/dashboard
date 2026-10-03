import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  organizerLocationSharing,
  organizerLocations,
} from "@/lib/db/schema/organizer-locations";
import { users, type UserEntry } from "@/lib/db/schema/users";
import { hasCheckedIn } from "@/lib/decisions";
import {
  PUBLIC_WINDOW_MINUTES,
  TRAIL_HOURS,
} from "@/lib/organizer-locations/display";

/**
 * - organizer: everyone sharing, with trails, battery, and stale positions.
 * - attendee: volunteers, judges, and checked-in hackers. Recent positions
 *   only, no trail or battery — enough to walk over to someone.
 * - none: everyone else, including hackers who haven't checked in. The page
 *   is for finding help at the venue, not for following organizers home.
 */
export type FindOrganizerAccess = "organizer" | "attendee" | "none";

export async function findOrganizerAccess(
  user: UserEntry,
): Promise<FindOrganizerAccess> {
  if (user.role === "organizer") return "organizer";
  if (user.role === "volunteer" || user.role === "judge") return "attendee";
  if (user.role !== "hacker") return "none";

  const [application] = await db
    .select({ decision: hackerApplicants.decision })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, user.id))
    .limit(1);
  return application && hasCheckedIn(application.decision)
    ? "attendee"
    : "none";
}

export type TrailPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export type MappedPerson = {
  /** Opaque and stable; never the user ID, which attendees have no use for. */
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  /** Organizer view only. */
  battery: number | null;
  /** Organizer view only; oldest first, ending at the latest fix. */
  trail: TrailPoint[];
};

export type OrganizerMapSnapshot = {
  people: MappedPerson[];
  /** Server time of the read, so "seen ago" doesn't use the viewer's clock. */
  readAt: string;
};

/*
  Timestamps come back from Postgres as text like "2026-10-03 21:00:00.12+00",
  which Node parses but Safari doesn't. Everything sent to the browser is ISO.
*/
function toIso(timestamp: string) {
  return new Date(timestamp).toISOString();
}

function opaqueId(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

/** Each sharing organizer's newest fix, optionally only recent ones. */
async function latestFixes(withinMinutes: number | null) {
  return (
    db
      .selectDistinctOn([organizerLocations.userId], {
        userId: organizerLocations.userId,
        name: organizerLocationSharing.displayName,
        latitude: organizerLocations.latitude,
        longitude: organizerLocations.longitude,
        accuracy: organizerLocations.accuracy,
        battery: organizerLocations.battery,
        recordedAt: organizerLocations.recordedAt,
      })
      .from(organizerLocations)
      .innerJoin(
        organizerLocationSharing,
        eq(organizerLocationSharing.userId, organizerLocations.userId),
      )
      // Someone who stops being an organizer drops off without having to stop
      // sharing first.
      .innerJoin(
        users,
        and(
          eq(users.id, organizerLocations.userId),
          eq(users.role, "organizer"),
        ),
      )
      .where(
        withinMinutes === null
          ? undefined
          : gt(
              organizerLocations.recordedAt,
              sql`now() - make_interval(mins => ${withinMinutes})`,
            ),
      )
      .orderBy(
        asc(organizerLocations.userId),
        desc(organizerLocations.recordedAt),
      )
  );
}

async function serverNow() {
  const [{ now }] = await db.execute<{ now: string }>(
    sql`select now()::text as now`,
  );
  return toIso(now);
}

const byName = (a: MappedPerson, b: MappedPerson) =>
  a.name.localeCompare(b.name);

async function readOrganizerView(): Promise<OrganizerMapSnapshot> {
  const [latest, trail, readAt] = await Promise.all([
    latestFixes(null),
    db
      .select({
        userId: organizerLocations.userId,
        latitude: organizerLocations.latitude,
        longitude: organizerLocations.longitude,
        recordedAt: organizerLocations.recordedAt,
      })
      .from(organizerLocations)
      .where(
        gt(
          organizerLocations.recordedAt,
          sql`now() - make_interval(hours => ${TRAIL_HOURS})`,
        ),
      )
      .orderBy(
        asc(organizerLocations.userId),
        asc(organizerLocations.recordedAt),
      ),
    serverNow(),
  ]);

  const trails = new Map<string, TrailPoint[]>();
  for (const { userId, recordedAt, ...point } of trail) {
    const points = trails.get(userId) ?? [];
    points.push({ ...point, recordedAt: toIso(recordedAt) });
    trails.set(userId, points);
  }

  const people = latest.map(({ userId, ...fix }) => ({
    ...fix,
    recordedAt: toIso(fix.recordedAt),
    id: opaqueId(userId),
    trail: trails.get(userId) ?? [],
  }));
  return { people: people.sort(byName), readAt };
}

async function readAttendeeView(): Promise<OrganizerMapSnapshot> {
  const [latest, readAt] = await Promise.all([
    latestFixes(PUBLIC_WINDOW_MINUTES),
    serverNow(),
  ]);
  const people = latest.map((fix) => ({
    id: opaqueId(fix.userId),
    name: fix.name,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    recordedAt: toIso(fix.recordedAt),
    battery: null,
    trail: [],
  }));
  return { people: people.sort(byName), readAt };
}

/*
  Every checked-in hacker with the page open refreshes it, so the attendee
  view is shared per server task: at most one read per ATTENDEE_CACHE_MS no
  matter how many people are watching. Organizers are few and want the
  freshest view, so theirs is read directly.
*/
const ATTENDEE_CACHE_MS = 10_000;
let attendeeCache: {
  expiresAt: number;
  snapshot: Promise<OrganizerMapSnapshot>;
} | null = null;

function cachedAttendeeView() {
  const now = Date.now();
  if (!attendeeCache || attendeeCache.expiresAt <= now) {
    const snapshot = readAttendeeView();
    attendeeCache = { expiresAt: now + ATTENDEE_CACHE_MS, snapshot };
    // A failed read must not be served to everyone for the next 10 seconds.
    snapshot.catch(() => {
      if (attendeeCache?.snapshot === snapshot) attendeeCache = null;
    });
  }
  return attendeeCache.snapshot;
}

/** Callers check access first; this trusts the level it is given. */
export function getOrganizerMap(
  access: Exclude<FindOrganizerAccess, "none">,
): Promise<OrganizerMapSnapshot> {
  return access === "organizer" ? readOrganizerView() : cachedAttendeeView();
}

export type MySharing = {
  displayName: string;
  createdAt: string;
  lastFixAt: string | null;
};

export async function getMySharing(userId: string): Promise<MySharing | null> {
  const [row] = await db
    .select({
      displayName: organizerLocationSharing.displayName,
      createdAt: organizerLocationSharing.createdAt,
      lastFixAt: sql<
        string | null
      >`(select max(${organizerLocations.recordedAt})::text from ${organizerLocations} where ${organizerLocations.userId} = ${organizerLocationSharing.userId})`,
    })
    .from(organizerLocationSharing)
    .where(eq(organizerLocationSharing.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    createdAt: toIso(row.createdAt),
    lastFixAt: row.lastFixAt ? toIso(row.lastFixAt) : null,
  };
}
