// Core check-in logic, parameterized by the scanning staffer's id. Kept out of
// the "use server" module so it stays a plain function — callable from the
// server actions, and directly exercisable by a script or a test without an
// HTTP session. Same split as application-form.actions.ts.

import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
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
  /** From their RSVP (which writes back to the application); null if the
   *  application row is gone. Shown so a volunteer can hand over a shirt. */
  shirtSize: string | null;
};

export type ScannedEvent = {
  id: string;
  name: string;
  /** How many scans one person is allowed here; 1 for most events. */
  maxCheckins: number;
};

export type CheckInResult =
  | {
      ok: true;
      outcome: "checked-in";
      message: string;
      attendee: ScannedAttendee;
      event: ScannedEvent;
      checkedInAt: string;
      /** Which of the event's allowed scans this was, 1-based. */
      scanNumber: number;
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
      /** On a duplicate: their most recent scan, and who made it. */
      checkedInAt?: string;
      checkedInByName?: string | null;
      /** On a duplicate: how many of the event's scans they have used. */
      scansUsed?: number;
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
      .select({
        id: events.id,
        name: events.name,
        isActive: events.isActive,
        requiresRsvp: events.requiresRsvp,
        maxCheckins: events.maxCheckins,
      })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    const event = eventRows[0];
    if (!event) return failure("event-closed");

    const scannedEvent: ScannedEvent = {
      id: event.id,
      name: event.name,
      maxCheckins: event.maxCheckins,
    };

    // Claim the attempt. An empty return means this exact clientScanId was
    // already processed for this event, so replay that outcome rather than
    // acting twice. Scoped to the event on both halves: a client id means
    // "this attempt at this door" and nothing wider, so matching it across
    // events would replay a verdict reached somewhere else entirely.
    const claimed = await tx
      .insert(eventScanLog)
      .values({
        eventId: event.id,
        scannedBy: staffId,
        outcome: "unknown_code", // provisional; corrected before commit
        clientScanId,
        rawCode: code.slice(0, MAX_RAW_CODE_LENGTH),
      })
      .onConflictDoNothing({
        target: [eventScanLog.eventId, eventScanLog.clientScanId],
      })
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
        shirtSize: hackerApplicants.shirtSize,
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
      shirtSize: row.shirtSize,
    };

    // Normal weekend events remain acceptance + RSVP gated. Qualifying and
    // outreach events explicitly turn this off because attendance there is
    // what organizers use to decide whom to admit; a public.users row is all
    // those events require.
    if (event.requiresRsvp) {
      // Two separate questions, because the volunteer needs to tell them apart:
      // someone who was never offered a spot is a different conversation from
      // someone who was offered one and never replied.
      if (
        row.decision === null ||
        !(RSVP_ELIGIBLE_DECISIONS as readonly string[]).includes(row.decision)
      ) {
        await finish("not-accepted", row.userId);
        return failure("not-accepted", { attendee, event: scannedEvent });
      }

      // An RSVP is the submitted row *and* the confirmed decision written
      // beside it. Either one missing means they never actually took the spot.
      const confirmed =
        row.rsvpId !== null &&
        (RSVP_CONFIRMED_DECISIONS as readonly string[]).includes(row.decision);

      if (!confirmed) {
        await finish("no-rsvp", row.userId);
        return failure("no-rsvp", { attendee, event: scannedEvent });
      }
    }

    // The unique constraint is the arbiter, not a prior SELECT: two volunteers
    // scanning the same badge at once both pick the same free slot, and only
    // one can win this insert. The loser looks again, and either takes the
    // next slot or finds none left. Bounded by the slot count, since every
    // lost race means a slot was filled.
    let fresh: { checkedInAt: string; scanNumber: number } | undefined;
    for (let attempt = 0; attempt < event.maxCheckins && !fresh; attempt++) {
      const slot = await nextFreeScanNumber(
        tx,
        event.id,
        row.userId,
        event.maxCheckins,
      );
      if (slot === null) break;

      const inserted = await tx
        .insert(eventCheckins)
        .values({
          eventId: event.id,
          userId: row.userId,
          checkedInBy: staffId,
          method,
          scanNumber: slot,
        })
        .onConflictDoNothing({
          target: [
            eventCheckins.eventId,
            eventCheckins.userId,
            eventCheckins.scanNumber,
          ],
        })
        .returning({
          checkedInAt: eventCheckins.checkedInAt,
          scanNumber: eventCheckins.scanNumber,
        });

      fresh = inserted[0];
    }

    if (!fresh) {
      const existing = await tx
        .select({
          checkedInAt: eventCheckins.checkedInAt,
          checkedInByName: personNameSql,
          scansUsed: sql<number>`(count(*) over ())::int`,
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
        .orderBy(desc(eventCheckins.checkedInAt))
        .limit(1);

      await finish("already-checked-in", row.userId);
      return failure("already-checked-in", {
        attendee,
        event: scannedEvent,
        checkedInAt: existing[0]?.checkedInAt,
        checkedInByName: existing[0]?.checkedInByName ?? null,
        scansUsed: existing[0]?.scansUsed,
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
      scanNumber: fresh.scanNumber,
    };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The lowest scan slot this person has not used at this event, or null when
 * every one of the event's allowed scans is taken. Lowest rather than
 * count + 1, so a reverted scan leaves a gap that the next scan fills instead
 * of a gap that permanently eats one of their scans.
 */
async function nextFreeScanNumber(
  tx: Tx,
  eventId: string,
  userId: string,
  maxCheckins: number,
): Promise<number | null> {
  const rows = await tx.execute<{ slot: number }>(sql`
    select slot::int as slot
    from generate_series(1, ${maxCheckins}::int) as slot
    where not exists (
      select 1 from ${eventCheckins}
      where ${eventCheckins.eventId} = ${eventId}
        and ${eventCheckins.userId} = ${userId}
        and ${eventCheckins.scanNumber} = slot
    )
    order by slot
    limit 1
  `);

  return rows[0]?.slot ?? null;
}

/** Reconstructs the response for an attempt that was already recorded. */
async function replayScan(
  tx: Tx,
  clientScanId: string,
  event: ScannedEvent,
): Promise<CheckInResult> {
  const rows = await tx
    .select({
      outcome: eventScanLog.outcome,
      userId: eventScanLog.userId,
      scannedAt: eventScanLog.scannedAt,
      email: users.email,
      name: personNameSql,
      university: hackerApplicants.university,
      shirtSize: hackerApplicants.shirtSize,
    })
    .from(eventScanLog)
    .leftJoin(users, eq(users.id, eventScanLog.userId))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, eventScanLog.userId),
    )
    .where(
      and(
        eq(eventScanLog.eventId, event.id),
        eq(eventScanLog.clientScanId, clientScanId),
      ),
    )
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
          shirtSize: row.shirtSize,
        }
      : null;

  if (row.outcome === "checked_in" && row.userId) {
    // A person can hold several check-ins here, so pick out the one this
    // attempt made. The log row and the check-in were written in the same
    // transaction, and both default to now() — the transaction's start time —
    // so their timestamps are identical.
    const checkin = await tx
      .select({
        checkedInAt: eventCheckins.checkedInAt,
        scanNumber: eventCheckins.scanNumber,
      })
      .from(eventCheckins)
      .where(
        and(
          eq(eventCheckins.eventId, event.id),
          eq(eventCheckins.userId, row.userId),
          eq(eventCheckins.checkedInAt, row.scannedAt),
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
        scanNumber: checkin[0].scanNumber,
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
  /** How many of the event's allowed scans they have already used. */
  scansUsed: number;
  /** Whether they have used every scan the event allows. */
  atLimit: boolean;
};

const searchSchema = z.strictObject({
  slug: eventSlugSchema,
  query: z.string().trim().min(2).max(120),
});

const MAX_SEARCH_RESULTS = 8;

/**
 * Name/email lookup for the manual fallback. Caller enforces staff access — a
 * dead camera, or a hacker who left their phone in the venue. The event's own
 * admission mode decides whether this includes confirmed RSVPs or all accounts.
 */
export async function searchAttendees(
  input: unknown,
): Promise<AttendeeMatch[]> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];

  const { slug, query } = parsed.data;

  const eventRows = await db
    .select({
      id: events.id,
      requiresRsvp: events.requiresRsvp,
      maxCheckins: events.maxCheckins,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  const event = eventRows[0];
  if (!event) return [];

  // Escape LIKE wildcards so a searched "%" doesn't match everybody.
  const term = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const eligibility = event.requiresRsvp
    ? and(
        isNotNull(hackerRsvps.id),
        inArray(hackerApplicants.decision, RSVP_CONFIRMED_DECISIONS),
      )
    : undefined;

  // A subquery rather than a join: someone scanned in more than once would
  // otherwise come back once per scan.
  const scansUsed = sql<number>`(
    select count(*)::int from ${eventCheckins}
    where ${eventCheckins.userId} = ${users.id}
      and ${eventCheckins.eventId} = ${event.id}
  )`;

  const rows = await db
    .select({
      userId: users.id,
      name: personNameSql,
      email: users.email,
      university: hackerApplicants.university,
      scansUsed,
    })
    .from(users)
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, users.id))
    .where(
      and(
        eligibility,
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
    .orderBy(hackerApplicants.firstName, hackerApplicants.lastName, users.email)
    .limit(MAX_SEARCH_RESULTS);

  return rows.map((row) => ({
    ...row,
    atLimit: row.scansUsed >= event.maxCheckins,
  }));
}
