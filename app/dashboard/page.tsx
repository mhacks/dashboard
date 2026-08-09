import { eq } from "drizzle-orm";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import type { ApplicationDecision } from "@/lib/decisions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const { id: userId } = await requireSessionUser();

  let application: {
    firstName: string;
    decision: ApplicationDecision;
    createdAt: string;
    reimbursementCents: number | null;
  } | null = null;

  try {
    // Neither join can multiply the applicant row: hacker_reimbursements is
    // unique per user_id, and region is the regions table's primary key.
    const rows = await db
      .select({
        firstName: hackerApplicants.firstName,
        decision: hackerApplicants.decision,
        createdAt: hackerApplicants.createdAt,
        // Null when the hacker has no award row — the signal for "no
        // reimbursement". The award's status is deliberately ignored; the
        // row existing at all is what grants it.
        reimbursementCents: reimbursementRegions.amountCents,
      })
      .from(hackerApplicants)
      .leftJoin(
        hackerReimbursements,
        eq(hackerReimbursements.userId, hackerApplicants.userId),
      )
      .leftJoin(
        reimbursementRegions,
        eq(reimbursementRegions.region, hackerReimbursements.region),
      )
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);
    application = rows[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants query failed:", cause);
  }

  return (
    <DashboardClient
      firstName={application?.firstName ?? null}
      decision={application?.decision ?? null}
      submittedAt={application?.createdAt ?? null}
      reimbursementCents={application?.reimbursementCents ?? null}
    />
  );
}
