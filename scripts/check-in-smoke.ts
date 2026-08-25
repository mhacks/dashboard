// End-to-end smoke test for the event check-in path, run against the local
// Supabase stack. Exercises the real checkInAttendee/searchAttendees functions
// rather than reimplementing their SQL, so the invariants it asserts — one
// check-in per person per event, idempotent retries, an append-only audit
// trail — are the ones the scanner actually relies on.
//
// Local only: it writes to the database and refuses to run anywhere else.
//
// Usage:
//   pnpm test:check-in
//
// Requires a seeded database (`pnpm db:reset`) with at least one accepted
// applicant; it creates and removes its own event, RSVP and staff fixtures.

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  checkInAttendee,
  searchAttendees,
} from "@/lib/actions/check-in.actions";
import { countsAsCheckIn, OUTCOME_SEVERITY } from "@/lib/checkin/outcomes";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { eventCheckins, events, eventScanLog } from "@/lib/db/schema/events";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { users } from "@/lib/db/schema/users";
import {
  RSVP_CONFIRMED_DECISIONS,
  RSVP_ELIGIBLE_DECISIONS,
} from "@/lib/decisions";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(databaseUrl)) {
  console.error(
    "Refusing to run: DATABASE_URL is not a local database.\n" +
      "This script writes check-in rows and must never touch a real event.",
  );
  process.exit(1);
}

const SLUG = `smoke-${randomUUID().slice(0, 8)}`;

let passed = 0;
let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = Object.is(got, want);
  console.log(
    `${ok ? "  ok  " : " FAIL "} ${label} → ${String(got)}` +
      (ok ? "" : `  (expected ${String(want)})`),
  );
  if (ok) passed++;
  else failed++;
}

/**
 * Somebody who has actually RSVPed, creating that state if nobody has.
 *
 * Creating it means both halves, exactly as submitting an RSVP does: the row,
 * and the confirmed decision written alongside it. A fixture that wrote only
 * the row would be a state the app never produces, and the check-in gate
 * rightly refuses it.
 */
async function eligibleAttendee() {
  const confirmed = await db
    .select({ userId: users.id })
    .from(hackerApplicants)
    .innerJoin(users, eq(users.id, hackerApplicants.userId))
    .innerJoin(hackerRsvps, eq(hackerRsvps.userId, hackerApplicants.userId))
    .where(inArray(hackerApplicants.decision, RSVP_CONFIRMED_DECISIONS))
    .limit(1);
  if (confirmed[0])
    return {
      userId: confirmed[0].userId,
      createdRsvp: false,
      priorDecision: null,
    };

  const candidates = await db
    .select({
      userId: hackerApplicants.userId,
      applicationId: hackerApplicants.id,
      decision: hackerApplicants.decision,
    })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, hackerApplicants.userId))
    .where(
      and(
        inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS),
        isNull(hackerRsvps.id),
      ),
    )
    .limit(1);

  const candidate = candidates[0];
  if (!candidate)
    throw new Error(
      "No accepted applicant in the database — run `pnpm db:reset`.",
    );

  await db.insert(hackerRsvps).values({
    userId: candidate.userId,
    applicationId: candidate.applicationId,
    travelPlan: "local",
    streetAddress: "123 S State St",
    city: "Ann Arbor",
    country: "United States",
    activitiesWaiverResponse: true,
    photoReleaseResponse: true,
  });

  // The other half of an RSVP.
  await db
    .update(hackerApplicants)
    .set({
      decision: candidate.decision.startsWith("early_")
        ? "early_rsvped"
        : "regular_rsvped",
    })
    .where(eq(hackerApplicants.userId, candidate.userId));

  return {
    userId: candidate.userId,
    createdRsvp: true,
    priorDecision: candidate.decision,
  };
}

const attendee = await eligibleAttendee();

const noRsvp = (
  await db
    .select({ userId: hackerApplicants.userId })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, hackerApplicants.userId))
    .where(
      and(
        inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS),
        isNull(hackerRsvps.id),
      ),
    )
    .limit(1)
)[0];

const notAccepted = (
  await db
    .select({ userId: hackerApplicants.userId })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.decision, "applied"))
    .limit(1)
)[0];

const [staff] = await db.select({ id: users.id }).from(users).limit(1);

const [event] = await db
  .insert(events)
  .values({ slug: SLUG, name: "Smoke Test Event", createdBy: staff.id })
  .returning({ id: events.id });

const scan = (
  code: string,
  opts: { clientScanId?: string; method?: "scan" | "manual" } = {},
) =>
  checkInAttendee(staff.id, {
    slug: SLUG,
    code,
    clientScanId: opts.clientScanId ?? randomUUID(),
    method: opts.method ?? "scan",
  });

try {
  console.log("\n— a first scan lets someone in —");
  const first = await scan(attendee.userId);
  check("outcome", first.outcome, "checked-in");
  check("names the attendee", Boolean(first.attendee?.name), true);
  check("names the event", first.event?.name, "Smoke Test Event");

  console.log("\n— a second scan is refused, but still identifies them —");
  const dup = await scan(attendee.userId);
  check("outcome", dup.outcome, "already-checked-in");
  check("still names them", dup.attendee?.userId, attendee.userId);
  check("says when", Boolean(dup.ok === false && dup.checkedInAt), true);
  check(
    "says who scanned",
    Boolean(dup.ok === false && dup.checkedInByName),
    true,
  );

  console.log("\n— a retried scan replays, it does not act twice —");
  await db.delete(eventCheckins).where(eq(eventCheckins.eventId, event.id));
  const retryId = randomUUID();
  const sent = await scan(attendee.userId, { clientScanId: retryId });
  const resent = await scan(attendee.userId, { clientScanId: retryId });
  check("first attempt", sent.outcome, "checked-in");
  check(
    "replay is the same success, not a duplicate",
    resent.outcome,
    "checked-in",
  );
  const afterRetry = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventCheckins)
    .where(eq(eventCheckins.eventId, event.id));
  check("still exactly one check-in", afterRetry[0].n, 1);

  console.log("\n— people who may not enter —");
  if (noRsvp)
    check(
      "accepted but no RSVP",
      (await scan(noRsvp.userId)).outcome,
      "no-rsvp",
    );
  if (notAccepted)
    check(
      "never accepted",
      (await scan(notAccepted.userId)).outcome,
      "not-accepted",
    );
  check(
    "someone else's QR code",
    (await scan("https://mlh.io")).outcome,
    "unknown-code",
  );
  check(
    "a UUID we don't know",
    (await scan(randomUUID())).outcome,
    "unknown-code",
  );

  console.log("\n— a closed event turns everyone away —");
  await db
    .update(events)
    .set({ isActive: false })
    .where(eq(events.id, event.id));
  check("outcome", (await scan(attendee.userId)).outcome, "event-closed");
  await db
    .update(events)
    .set({ isActive: true })
    .where(eq(events.id, event.id));

  console.log("\n— the audit trail —");
  const log = await db
    .select()
    .from(eventScanLog)
    .where(eq(eventScanLog.eventId, event.id));
  check("every attempt was recorded", log.length > 0, true);
  check(
    "the raw text is kept only when it resolved to nobody",
    log.filter((r) => r.rawCode !== null).every((r) => r.userId === null),
    true,
  );
  console.log(
    "   outcomes:",
    log
      .map((r) => r.outcome)
      .sort()
      .join(", "),
  );

  console.log("\n— only real arrivals move the running total —");
  // The scanner's counter is driven entirely by countsAsCheckIn, so asserting
  // it here covers every branch the UI can take.
  for (const outcome of Object.keys(
    OUTCOME_SEVERITY,
  ) as (keyof typeof OUTCOME_SEVERITY)[]) {
    check(
      `${outcome} counts`,
      countsAsCheckIn(outcome),
      outcome === "checked-in",
    );
  }

  // And the same rule holds against real responses, not just the enum.
  await db.delete(eventCheckins).where(eq(eventCheckins.eventId, event.id));
  let counter = 0;
  const tally = async (code: string) => {
    const r = await scan(code);
    if (countsAsCheckIn(r.outcome)) counter++;
    return r.outcome;
  };
  const sequence = [
    await tally("not-a-uuid"),
    await tally(randomUUID()),
    await tally(attendee.userId),
    await tally(attendee.userId),
    ...(notAccepted ? [await tally(notAccepted.userId)] : []),
  ];
  console.log("   sequence:", sequence.join(", "));
  const [{ n: actual }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventCheckins)
    .where(eq(eventCheckins.eventId, event.id));
  check("counter after that sequence", counter, 1);
  check("matches rows actually in the database", counter, actual);

  console.log("\n— manual search —");
  const matches = await searchAttendees({
    slug: SLUG,
    query: attendee.userId.slice(0, 8),
  });
  check("a UUID fragment is not a name match", matches.length, 0);
  if (notAccepted) {
    const ineligible = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, notAccepted.userId))
      .limit(1);
    check(
      "ineligible people are never offered",
      (await searchAttendees({ slug: SLUG, query: ineligible[0].email }))
        .length,
      0,
    );
  }
  check(
    "a bare wildcard matches nobody",
    (await searchAttendees({ slug: SLUG, query: "%%" })).length,
    0,
  );
} finally {
  // Cascades to this event's check-ins and scan log.
  await db.delete(events).where(eq(events.id, event.id));
  if (attendee.createdRsvp) {
    await db.delete(hackerRsvps).where(eq(hackerRsvps.userId, attendee.userId));
    if (attendee.priorDecision) {
      await db
        .update(hackerApplicants)
        .set({ decision: attendee.priorDecision })
        .where(eq(hackerApplicants.userId, attendee.userId));
    }
  }
}

console.log(
  `\n${failed === 0 ? "ALL PASS" : "FAILED"} — ${passed} passed, ${failed} failed`,
);
process.exit(failed === 0 ? 0 : 1);
