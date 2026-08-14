import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import type { ApplicationDecision } from "@/lib/decisions";

export type ApplicantDecisionRow = {
  firstName: string;
  decision: ApplicationDecision;
  createdAt: string;
  /** Awarded travel tier in cents, or null when there's no approved award. */
  reimbursementCents: number | null;
};

/**
 * Everything the dashboard and the decision letter need about where an
 * applicant stands. Shared between the two so the letter can never disagree
 * with the panel that links to it.
 *
 * Returns null when there is no applicant row — either the applicant hasn't
 * submitted, or the query failed. Failures are logged and degraded rather than
 * thrown: a dashboard that renders its "haven't applied yet" state is a better
 * outcome than an error page.
 */
export async function getApplicantDecision(
  userId: string,
): Promise<ApplicantDecisionRow | null> {
  try {
    // Neither join can multiply the applicant row: hacker_reimbursements is
    // unique per user_id, and region is the regions table's primary key.
    const rows = await db
      .select({
        firstName: hackerApplicants.firstName,
        decision: hackerApplicants.decision,
        createdAt: hackerApplicants.createdAt,
        // Null when there's no approved award — no row, or a denied one. Denied
        // rows keep their region for audit/analytics but must not grant letter
        // copy; only status = approved joins through below.
        reimbursementCents: reimbursementRegions.amountCents,
      })
      .from(hackerApplicants)
      .leftJoin(
        hackerReimbursements,
        and(
          eq(hackerReimbursements.userId, hackerApplicants.userId),
          eq(hackerReimbursements.status, "approved"),
        ),
      )
      .leftJoin(
        reimbursementRegions,
        eq(reimbursementRegions.region, hackerReimbursements.region),
      )
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);

    return rows[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants query failed:", cause);
    return null;
  }
}
