import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { sendEmail } from "@/lib/aws/ses";
import { db } from "@/lib/db";
import { hackerApplicationInvitations } from "@/lib/db/schema/application-invitations";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { users } from "@/lib/db/schema/users";
import type { ApplicationDecision } from "@/lib/decisions";
import { buildApplicationDecisionEmail } from "@/lib/email/application-decision-template";
import { getApplicationRound } from "@/lib/types/application-reviews";
import { getRequestOrigin } from "@/lib/url/request-origin";

/**
 * Applies an invitation's auto-accept setting after a successful insert. Any
 * failure is logged and contained because the application itself has already
 * been submitted; the Backdoor page remains the organizer's manual fallback.
 */
export async function autoAcceptInvitedApplication({
  applicationId,
  userId,
}: {
  applicationId: string;
  userId: string;
}) {
  try {
    const accepted = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({
          firstName: hackerApplicants.firstName,
          email: users.email,
          decision: hackerApplicants.decision,
          createdAt: hackerApplicants.createdAt,
          reimbursementCents: reimbursementRegions.amountCents,
        })
        .from(hackerApplicants)
        .innerJoin(users, eq(users.id, hackerApplicants.userId))
        .innerJoin(
          hackerApplicationInvitations,
          sql`${hackerApplicationInvitations.email} = lower(${users.email})`,
        )
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
        .where(
          and(
            eq(hackerApplicants.id, applicationId),
            eq(hackerApplicants.userId, userId),
            eq(hackerApplicationInvitations.autoAccept, true),
            isNull(hackerApplicationInvitations.revokedAt),
            gt(
              hackerApplicationInvitations.expiresAt,
              new Date().toISOString(),
            ),
          ),
        )
        .limit(1)
        .for("update", { of: hackerApplicants });

      if (!target || target.decision !== "applied") return null;

      const decision: ApplicationDecision =
        getApplicationRound(target.createdAt) === "early"
          ? "early_accepted"
          : "regular_accepted";
      const now = new Date().toISOString();

      await tx
        .update(hackerApplicants)
        .set({ decision, updatedAt: now })
        .where(eq(hackerApplicants.id, applicationId));

      return { ...target, decision };
    });

    if (!accepted) return false;

    try {
      const origin = await getRequestOrigin();
      const loginParams = new URLSearchParams({
        email: accepted.email,
        next: "/dashboard/decision",
        utm_source: "decision_email",
      });
      const message = await buildApplicationDecisionEmail({
        decision: accepted.decision,
        firstName: accepted.firstName,
        decisionUrl: `${origin}/login?${loginParams.toString()}`,
        reimbursementCents: accepted.reimbursementCents,
      });
      await sendEmail({ to: accepted.email, ...message });
    } catch (error) {
      console.error(
        "Auto-accept succeeded but its decision email failed:",
        error,
      );
    }

    return true;
  } catch (error) {
    console.error("Unable to auto-accept invited application:", error);
    return false;
  }
}
