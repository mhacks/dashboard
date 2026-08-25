import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { RSVP_ELIGIBLE_DECISIONS } from "@/lib/decisions";

/**
 * Whether this user may hold a check-in code: accepted, and RSVPed.
 *
 * Both halves matter. The decision alone would hand a code to someone who never
 * confirmed and has no spot; the RSVP row alone can't outlive a decision being
 * reversed. The scanner re-checks exactly these two conditions server-side, so
 * this is a display gate rather than a security boundary — showing a code to
 * someone who shouldn't have one would only get them turned away at the door.
 *
 * Failures degrade to `false` rather than throwing, matching
 * `getApplicantDecision`: a dashboard missing its QR button beats an error page.
 */
export async function getAttendeeQrEligibility(
  userId: string,
): Promise<boolean> {
  try {
    const rows = await db
      .select({ userId: hackerApplicants.userId })
      .from(hackerApplicants)
      // Inner join, so no RSVP row means no result at all.
      .innerJoin(hackerRsvps, eq(hackerRsvps.userId, hackerApplicants.userId))
      .where(
        and(
          eq(hackerApplicants.userId, userId),
          inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS),
        ),
      )
      .limit(1);

    return rows.length > 0;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] check-in eligibility query failed:", cause);
    return false;
  }
}
