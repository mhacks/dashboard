import { createHash } from "node:crypto";
import { eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { organizerLocations } from "@/lib/db/schema/organizer-locations";
import type { UserEntry } from "@/lib/db/schema/users";
import { hasCheckedIn } from "@/lib/decisions";
import {
  PUBLIC_WINDOW_MINUTES,
  ORGANIZER_WINDOW_HOURS,
} from "@/lib/organizer-locations/display";

/**
 * - organizer: everyone on the map, with battery and stale positions.
 * - attendee: volunteers, judges, and checked-in hackers. Recent positions
 *   only, no battery — enough to walk over to someone.
 * - none: everyone else, including hackers who haven't checked in. The page
 *   is for finding help at the venue, not for following organizers home.
 */
export type FindOrganizerAccess = "organizer" | "attendee" | "none";

/**
 * Find my organizer, its hunt code entry, and the puzzle behind it are hidden
 * from hackers for now: they see "the scavenger hunt has ended" and codes
 * can't be redeemed.
 * Organizers, volunteers, and judges keep the map.
 */
export function isFindMyOrganizerHidden(user: UserEntry): boolean {
  return user.role === "hacker";
}

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

export type MappedPerson = {
  /** Stable across refreshes, so a person keeps their color. */
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  /** Organizer view only. */
  battery: number | null;
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

function opaqueId(name: string) {
  return createHash("sha256").update(name).digest("hex").slice(0, 12);
}

/** Everyone whose latest fix is within the window. */
async function latestFixes(withinMinutes: number) {
  return db
    .select({
      name: organizerLocations.name,
      latitude: organizerLocations.latitude,
      longitude: organizerLocations.longitude,
      accuracy: organizerLocations.accuracy,
      battery: organizerLocations.battery,
      recordedAt: organizerLocations.recordedAt,
    })
    .from(organizerLocations)
    .where(
      gt(
        organizerLocations.recordedAt,
        sql`now() - make_interval(mins => ${withinMinutes})`,
      ),
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
  const [latest, readAt] = await Promise.all([
    // The same window as the ingest route's cleanup.
    latestFixes(ORGANIZER_WINDOW_HOURS * 60),
    serverNow(),
  ]);
  const people = latest.map((fix) => ({
    ...fix,
    recordedAt: toIso(fix.recordedAt),
    id: opaqueId(fix.name),
  }));
  return { people: people.sort(byName), readAt };
}

async function readAttendeeView(): Promise<OrganizerMapSnapshot> {
  const [latest, readAt] = await Promise.all([
    latestFixes(PUBLIC_WINDOW_MINUTES),
    serverNow(),
  ]);
  const people = latest.map((fix) => ({
    id: opaqueId(fix.name),
    name: fix.name,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    recordedAt: toIso(fix.recordedAt),
    battery: null,
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
