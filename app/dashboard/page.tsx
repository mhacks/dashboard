import { and, eq } from "drizzle-orm";

import { getDraftForUser } from "@/lib/actions/application-form.actions";
import { completedStepCount, isDraftStarted } from "@/lib/application-steps";
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
  const { id: userId, role } = await requireSessionUser();

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
    application = rows[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants query failed:", cause);
  }

  // Only meaningful before submitting — submitting deletes the draft row. Note
  // /apply writes an empty draft on first visit, so progress is measured from
  // the contents rather than the row's existence.
  let draftSteps = 0;
  if (!application) {
    try {
      const draft = await getDraftForUser(userId);
      // 0 means "nothing started". Guarded by isDraftStarted because the
      // field-less Socials step makes even an untouched draft score 1.
      draftSteps =
        draft && isDraftStarted(draft) ? completedStepCount(draft) : 0;
    } catch (err) {
      const cause = err instanceof Error ? (err.cause ?? err) : err;
      console.error("[DB] application draft query failed:", cause);
    }
  }

  return (
    <DashboardClient
      role={role}
      firstName={application?.firstName ?? null}
      decision={application?.decision ?? null}
      submittedAt={application?.createdAt ?? null}
      reimbursementCents={application?.reimbursementCents ?? null}
      draftSteps={draftSteps}
    />
  );
}
