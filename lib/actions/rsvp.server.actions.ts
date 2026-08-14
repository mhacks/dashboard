"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  decisionOutcome,
  decisionRound,
  type ApplicationDecision,
} from "@/lib/decisions";

/**
 * Confirm an accepted applicant's RSVP.
 *
 * SECURITY: lib/db connects over DATABASE_URL as a role that bypasses RLS, so
 * the `hacker_applicants_update_organizer` policy does NOT protect this write.
 * This action is its own authorization boundary, which is why it:
 *
 *   - takes no arguments. The decision, the round and the user id are all
 *     derived server-side; nothing the client sends can steer the write.
 *   - scopes the update to the session user's own row.
 *   - permits exactly two transitions, accepted -> rsvped. An `applied` or
 *     `_rejected` row can never RSVP itself into the event.
 *
 * Idempotent: an already-RSVPed applicant is a no-op, not an error, so a
 * double submit or a stale tab does the harmless thing.
 */
export async function confirmRsvp(): Promise<void> {
  const { id: userId } = await requireSessionUser();

  const [row] = await db
    .select({ decision: hackerApplicants.decision })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);

  if (!row) throw new Error("No application found");

  const current = row.decision;
  const round = decisionRound(current);

  // Already confirmed — report success without touching the row.
  if (current === "early_rsvped" || current === "regular_rsvped") return;

  if (!round || decisionOutcome(current) !== "accepted") {
    throw new Error("Not eligible to RSVP");
  }

  const next: ApplicationDecision =
    round === "early" ? "early_rsvped" : "regular_rsvped";

  // Matching on the decision we just read makes this a compare-and-set: two
  // concurrent submits leave the row in the same state, and the second writes
  // nothing.
  await db
    .update(hackerApplicants)
    .set({ decision: next, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(hackerApplicants.userId, userId),
        eq(hackerApplicants.decision, current),
      ),
    );

  revalidatePath("/dashboard/decision");
  revalidatePath("/dashboard");
}
