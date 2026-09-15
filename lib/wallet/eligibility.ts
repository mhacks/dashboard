import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { RSVP_CONFIRMED_DECISIONS } from "@/lib/decisions";

/**
 * The Wallet pass is the check-in code in another form, so it follows the same
 * rule as getAttendeeQrEligibility (lib/queries/check-in.ts): an RSVP row and a
 * confirmed decision, both. Anyone who can't see the dashboard QR can't get a
 * pass either.
 *
 * Re-checked on every download, so an RSVP that is later deleted can't be
 * turned into a pass with an old emailed link. Unlike the dashboard query this
 * throws on failure; the route turns that into a 500 rather than a silent 403.
 */
export async function getWalletPassHolder(userId: string) {
  const [row] = await db
    .select({
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
    })
    .from(hackerApplicants)
    // Inner join, so no RSVP row means no result at all.
    .innerJoin(hackerRsvps, eq(hackerRsvps.userId, hackerApplicants.userId))
    .where(
      and(
        eq(hackerApplicants.userId, userId),
        inArray(hackerApplicants.decision, RSVP_CONFIRMED_DECISIONS),
      ),
    )
    .limit(1);

  return row ?? null;
}
