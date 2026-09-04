// Core check-in logic, parameterized by the scanning staffer's id. Kept out of
// the "use server" module so it stays a plain function — callable from the
// server actions, and directly exercisable by a script or a test without an
// HTTP session. Same split as application-form.actions.ts.

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { personNameSql } from "@/lib/db/person-name";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  eventCheckins,
  events,
  eventScanLog,
  type EventScanOutcome,
} from "@/lib/db/schema/events";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { users } from "@/lib/db/schema/users";
import {
  OUTCOME_GUIDANCE,
  OUTCOME_HEADLINE,
  type CheckInOutcome,
} from "@/lib/checkin/outcomes";
import {
  RSVP_CONFIRMED_DECISIONS,
  RSVP_ELIGIBLE_DECISIONS,
} from "@/lib/decisions";
import { eventSlugSchema } from "@/lib/types/events";

export type ScannedAttendee = {
  userId: string;
  name: string;
  email: string;
  university: string | null;
};

export type ScannedEvent = { id: string; name: string };

export type CheckInResult =
  | {
      ok: true;
      outcome: "checked-in";
      message: string;
      attendee: ScannedAttendee;
      event: ScannedEvent;
      checkedInAt: string;
    }
  | {
      ok: false;
      outcome: Exclude<CheckInOutcome, "checked-in">;
      message: string;
      /**
       * Populated wherever the code resolved to a real person — an amber
       * duplicate without a name is useless at a door, because the volunteer
       * can't tell "you already came in" from "who are you".
       */
      attendee: ScannedAttendee | null;
      event: ScannedEvent | null;
      checkedInAt?: string;
      checkedInByName?: string | null;
    };

const checkInSchema = z.strictObject({
  slug: eventSlugSchema,
  /** Raw scanner text. Validated as a UUID below rather than here, so a
   *  non-UUID scan is recorded as unknown_code instead of a parse failure. */
  code: z.string().trim().min(1).max(512),
  clientScanId: z.uuid(),
  method: z.enum(["scan", "manual"]),
});

/** The scan log holds arbitrary text a camera read; keep it bounded. */
const MAX_RAW_CODE_LENGTH = 128;

function failure(
  outcome: Exclude<CheckInOutcome, "checked-in">,
  extra: Partial<Omit<CheckInResult & { ok: false }, "ok" | "outcome">> = {},
): CheckInResult {
  return {
    ok: false,
    outcome,
    message: OUTCOME_GUIDANCE[outcome] ?? OUTCOME_HEADLINE[outcome],
    attendee: null,
    event: null,
    ...extra,
  };
}

/** Maps the client-facing outcome onto the enum stored in the scan log. */
const LOGGED_OUTCOME: Record<
  Exclude<CheckInOutcome, "server-error">,
  EventScanOutcome
> = {
  "checked-in": "checked_in",
  "already-checked-in": "already_checked_in",
  "unknown-code": "unknown_code",
  "not-accepted": "not_accepted",
  "no-rsvp": "no_rsvp",
  "event-closed": "event_closed",
};

/**
 * Records one scan against one event. Callers must have already established
 * that `staffId` belongs to event staff.
 *
 * The whole thing runs in a single transaction, and the ordering matters: the
 * scan log row is claimed *first*, keyed on the client's per-attempt id. A
 * retry over flaky venue wifi therefore replays whatever the first attempt
 * decided instead of re-running the check and reporting the original success
 * back as a duplicate.
 */
export async function checkInAttendee(
  staffId: string,
  input: unknown,
): Promise<CheckInResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return failure("server-error");

  const { slug, code, clientScanId, method } = parsed.data;

  return db.transaction(async (tx) => {
    const eventRows = await tx
      .select({ id: events.id, name: events.name, isActive: events.isActive })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    const event = eventRows[0];
    if (!event) return failure("event-closed");

    const scannedEvent: ScannedEvent = { id: event.id, name: event.name };

    // Claim the attempt. An empty return means this exact clientScanId was
    // already processed, so replay that outcome rather than acting twice.
    const claimed = await tx
      .insert(eventScanLog)
      .values({
        eventId: event.id,
        scannedBy: staffId,
        outcome: "unknown_code", // provisional; corrected before commit
        clientScanId,
        rawCode: code.slice(0, MAX_RAW_CODE_LENGTH),
      })
      .onConflictDoNothing({ target: eventScanLog.clientScanId })
      .returning({ id: eventScanLog.id });

    const logId = claimed[0]?.id ?? null;
    if (!logId) return replayScan(tx, clientScanId, scannedEvent);

    const finish = async (
      outcome: Exclude<CheckInOutcome, "server-error">,
      userId: string | null,
    ) => {
      await tx
        .update(eventScanLog)
        .set({
          outcome: LOGGED_OUTCOME[outcome],
          userId,
          // Only worth keeping when there is no user to point at; otherwise it
          // just repeats the UUID on every row.
          rawCode: userId ? null : code.slice(0, MAX_RAW_CODE_LENGTH),
        })
        .where(eq(eventScanLog.id, logId));
    };

    if (!event.isActive) {
      await finish("event-closed", null);
      return failure("event-closed", { event: scannedEvent });
    }

    // A code that isn't a UUID can't be one of ours. Recorded, not thrown.
    if (!z.uuid().safeParse(code).success) {
      await finish("unknown-code", null);
      return failure("unknown-code", { event: scannedEvent });
    }

    const attendeeRows = await tx
      .select({
        userId: users.id,
        email: users.email,
        name: personNameSql,
        university: hackerApplicants.university,
        decision: hackerApplicants.decision,
        rsvpId: hackerRsvps.id,
      })
      .from(users)
      .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
      .leftJoin(hackerRsvps, eq(hackerRsvps.userId, users.id))
      .where(eq(users.id, code))
      .limit(1);

    const row = attendeeRows[0];
    if (!row) {
      await finish("unknown-code", null);
      return failure("unknown-code", { event: scannedEvent });
    }

    const attendee: ScannedAttendee = {
      userId: row.userId,
      name: row.name,
      email: row.email,
      university: row.university,
    };

    // Two separate questions, because the volunteer needs to tell them apart:
    // someone who was never offered a spot is a different conversation from
    // someone who was offered one and never replied.
    // A null decision means no application row at all, which is the same
    // answer as a rejected one: they have no spot here.
    if (
      row.decision === null ||
      !(RSVP_ELIGIBLE_DECISIONS as readonly string[]).includes(row.decision)
    ) {
      await finish("not-accepted", row.userId);
      return failure("not-accepted", { attendee, event: scannedEvent });
    }

    // An RSVP is the submitted row *and* the confirmed decision written beside
    // it. Either one missing means they never actually took the spot, and being
    // accepted alone does not get anyone through a door.
    const confirmed =
      row.rsvpId !== null &&
      (RSVP_CONFIRMED_DECISIONS as readonly string[]).includes(row.decision);

    if (!confirmed) {
      await finish("no-rsvp", row.userId);
      return failure("no-rsvp", { attendee, event: scannedEvent });
    }

    // The unique constraint is the arbiter, not a prior SELECT: two volunteers
    // scanning the same badge at once both pass a read, and only one can win
    // this insert.
    const inserted = await tx
      .insert(eventCheckins)
      .values({
        eventId: event.id,
        userId: row.userId,
        checkedInBy: staffId,
        method,
      })
      .onConflictDoNothing({
        target: [eventCheckins.eventId, eventCheckins.userId],
      })
      .returning({ checkedInAt: eventCheckins.checkedInAt });

    const fresh = inserted[0];
    if (!fresh) {
      const existing = await tx
        .select({
          checkedInAt: eventCheckins.checkedInAt,
          checkedInByName: personNameSql,
        })
        .from(eventCheckins)
        .leftJoin(users, eq(users.id, eventCheckins.checkedInBy))
        .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
        .where(
          and(
            eq(eventCheckins.eventId, event.id),
            eq(eventCheckins.userId, row.userId),
          ),
        )
        .limit(1);

      await finish("already-checked-in", row.userId);
      return failure("already-checked-in", {
        attendee,
        event: scannedEvent,
        checkedInAt: existing[0]?.checkedInAt,
        checkedInByName: existing[0]?.checkedInByName ?? null,
      });
    }

    await finish("checked-in", row.userId);

    return {
      ok: true as const,
      outcome: "checked-in" as const,
      message: OUTCOME_HEADLINE["checked-in"],
      attendee,
      event: scannedEvent,
      checkedInAt: fresh.checkedInAt,
    };
  });
}

/** Reconstructs the response for an attempt that was already recorded. */
async function replayScan(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  clientScanId: string,
  event: ScannedEvent,
): Promise<CheckInResult> {
  const rows = await tx
    .select({
      outcome: eventScanLog.outcome,
      userId: eventScanLog.userId,
      email: users.email,
      name: personNameSql,
      university: hackerApplicants.university,
    })
    .from(eventScanLog)
    .leftJoin(users, eq(users.id, eventScanLog.userId))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, eventScanLog.userId),
    )
    .where(eq(eventScanLog.clientScanId, clientScanId))
    .limit(1);

  const row = rows[0];
  if (!row) return failure("server-error", { event });

  const attendee: ScannedAttendee | null =
    row.userId && row.email
      ? {
          userId: row.userId,
          name: row.name,
          email: row.email,
          university: row.university,
        }
      : null;

  if (row.outcome === "checked_in" && row.userId) {
    const checkin = await tx
      .select({ checkedInAt: eventCheckins.checkedInAt })
      .from(eventCheckins)
      .where(
        and(
          eq(eventCheckins.eventId, event.id),
          eq(eventCheckins.userId, row.userId),
        ),
      )
      .limit(1);

    // If the check-in was since reverted there is nothing to replay as a
    // success, so this falls through to the generic mapping below.
    if (attendee && checkin[0]) {
      return {
        ok: true,
        outcome: "checked-in",
        message: OUTCOME_HEADLINE["checked-in"],
        attendee,
        event,
        checkedInAt: checkin[0].checkedInAt,
      };
    }
  }

  const REPLAYABLE: Partial<Record<EventScanOutcome, CheckInOutcome>> = {
    already_checked_in: "already-checked-in",
    unknown_code: "unknown-code",
    not_accepted: "not-accepted",
    no_rsvp: "no-rsvp",
    event_closed: "event-closed",
  };

  const outcome = REPLAYABLE[row.outcome] ?? "server-error";
  return failure(outcome as Exclude<CheckInOutcome, "checked-in">, {
    attendee,
    event,
  });
}

export type AttendeeMatch = {
  userId: string;
  name: string;
  email: string;
  university: string | null;
  checkedIn: boolean;
};

const searchSchema = z.strictObject({
  slug: eventSlugSchema,
  query: z.string().trim().min(2).max(120),
});

const MAX_SEARCH_RESULTS = 8;

/**
 * Name/email lookup for the manual fallback. Caller enforces staff access — a dead camera, or a hacker who
 * left their phone in the venue. Only ever returns people who could actually be
 * checked in, so a volunteer can't manually admit someone who never RSVPed.
 */
export async function searchAttendees(
  input: unknown,
): Promise<AttendeeMatch[]> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];

  const { slug, query } = parsed.data;

  const eventRows = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  const event = eventRows[0];
  if (!event) return [];

  // Escape LIKE wildcards so a searched "%" doesn't match everybody.
  const term = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  return db
    .select({
      userId: users.id,
      name: personNameSql,
      email: users.email,
      university: hackerApplicants.university,
      checkedIn: sql<boolean>`${eventCheckins.id} is not null`,
    })
    .from(hackerApplicants)
    .innerJoin(users, eq(users.id, hackerApplicants.userId))
    .innerJoin(hackerRsvps, eq(hackerRsvps.userId, hackerApplicants.userId))
    .leftJoin(
      eventCheckins,
      and(
        eq(eventCheckins.userId, hackerApplicants.userId),
        eq(eventCheckins.eventId, event.id),
      ),
    )
    .where(
      and(
        inArray(hackerApplicants.decision, RSVP_CONFIRMED_DECISIONS),
        or(
          ilike(hackerApplicants.firstName, term),
          ilike(hackerApplicants.lastName, term),
          ilike(users.email, term),
          ilike(
            sql`trim(${hackerApplicants.firstName} || ' ' || ${hackerApplicants.lastName})`,
            term,
          ),
        ),
      ),
    )
    .orderBy(hackerApplicants.firstName, hackerApplicants.lastName)
    .limit(MAX_SEARCH_RESULTS);
}
