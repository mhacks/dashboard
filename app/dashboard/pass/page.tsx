import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { prefillTicket, type PassApplicant } from "@/lib/pass/prefill";
import { PassStudio } from "./pass-client";

export default async function PassPage() {
  const { id: userId } = await requireSessionUser();

  let row: (PassApplicant & { decision: ApplicationDecision }) | null = null;

  try {
    // Explicit columns rather than select(): the essay fields are large and
    // would ride into the RSC payload for a pass that never shows them.
    const rows = await db
      .select({
        id: hackerApplicants.id,
        decision: hackerApplicants.decision,
        firstName: hackerApplicants.firstName,
        lastName: hackerApplicants.lastName,
        comingFrom: hackerApplicants.comingFrom,
        degree: hackerApplicants.degree,
        graduationYear: hackerApplicants.graduationYear,
        major: hackerApplicants.major,
        previousHackathons: hackerApplicants.previousHackathons,
      })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);
    row = rows[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants pass query failed:", cause);
  }

  // The pass is a perk of getting in: accepted in either round, RSVPed or not.
  // Everyone else is turned away — applicants still under review, rejected
  // hackers, organizers, and anyone with no application at all.
  //
  // A failed query lands here too, since it is indistinguishable from "no row".
  // That is the right way to fail for a gated surface: the safe default is to
  // send someone back, not to hand out a pass we could not verify.
  //
  // Outside the try above on purpose: redirect() throws NEXT_REDIRECT, and the
  // catch would swallow the navigation.
  if (!row || decisionOutcome(row.decision) !== "accepted") {
    redirect("/dashboard");
  }

  return <PassStudio initial={prefillTicket(row)} firstName={row.firstName} />;
}
