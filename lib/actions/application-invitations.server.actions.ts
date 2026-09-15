"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicationInvitations } from "@/lib/db/schema/application-invitations";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { users } from "@/lib/db/schema/users";
import { sendEmail } from "@/lib/aws/ses";
import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { buildApplicationDecisionEmail } from "@/lib/email/application-decision-template";
import { sendApplicationInvitationEmail } from "@/lib/email/send-invite-email";
import { getPostHogClient } from "@/lib/posthog-server";
import { getAdminApplicationInvitationById } from "@/lib/queries/application-invitations";
import { getApplicationRound } from "@/lib/types/application-reviews";
import { getRequestOrigin } from "@/lib/url/request-origin";
import {
  acceptInvitedApplicantSchema,
  createApplicationInvitationSchema,
  revokeApplicationInvitationSchema,
  type AcceptInvitedApplicantResult,
  type CreateApplicationInvitationResult,
  type RevokeApplicationInvitationResult,
} from "@/lib/types/application-invitations";

export async function createApplicationInvitationAction(
  input: unknown,
): Promise<CreateApplicationInvitationResult> {
  const organizer = await requireOrganizer();
  const parsed = createApplicationInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter an email and a duration between 1 hour and 30 days.",
    };
  }

  const { email, durationHours, note, autoAccept } = parsed.data;
  const [existingUser] = await db
    .select({
      id: users.id,
      role: users.role,
      applicationId: hackerApplicants.id,
    })
    .from(users)
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existingUser?.applicationId) {
    return { ok: false, message: "That hacker has already applied." };
  }
  if (existingUser && existingUser.role !== "hacker") {
    return {
      ok: false,
      message: `That account has the ${existingUser.role} role, not the hacker role.`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  const [saved] = await db
    .insert(hackerApplicationInvitations)
    .values({
      email,
      invitedByUserId: organizer.id,
      expiresAt: expiresAt.toISOString(),
      note,
      autoAccept,
      revokedAt: null,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: hackerApplicationInvitations.email,
      set: {
        invitedByUserId: organizer.id,
        expiresAt: expiresAt.toISOString(),
        note,
        autoAccept,
        revokedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    })
    .returning({ id: hackerApplicationInvitations.id });

  const invitation = saved
    ? await getAdminApplicationInvitationById(saved.id)
    : null;
  if (!invitation) {
    return { ok: false, message: "Unable to load the saved invitation." };
  }

  let emailSent = true;
  try {
    await sendApplicationInvitationEmail(email, expiresAt);
  } catch (error) {
    emailSent = false;
    console.error("Unable to send hacker application invitation:", error);
  }

  revalidatePath("/admin/backdoor");
  revalidatePath("/apply");
  revalidatePath("/dashboard");
  return { ok: true, invitation, emailSent };
}

/**
 * Accepts only the application associated with this Backdoor invitation and
 * then sends its decision letter. Committing before delivery makes an email
 * outage recoverable: the row becomes accepted, and this action turns into an
 * idempotent resend without ever downgrading an RSVP-confirmed decision.
 */
export async function acceptInvitedApplicantAction(
  input: unknown,
): Promise<AcceptInvitedApplicantResult> {
  const organizer = await requireOrganizer();
  const parsed = acceptInvitedApplicantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid invitation." };

  const accepted = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        applicationId: hackerApplicants.id,
        userId: hackerApplicants.userId,
        firstName: hackerApplicants.firstName,
        email: users.email,
        decision: hackerApplicants.decision,
        createdAt: hackerApplicants.createdAt,
        reimbursementCents: reimbursementRegions.amountCents,
      })
      .from(hackerApplicationInvitations)
      .innerJoin(
        users,
        sql`lower(${users.email}) = ${hackerApplicationInvitations.email}`,
      )
      .innerJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
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
      .where(eq(hackerApplicationInvitations.id, parsed.data.invitationId))
      .limit(1)
      .for("update", { of: hackerApplicants });

    if (!target) {
      return {
        ok: false as const,
        message: "This invitation does not have a submitted application yet.",
      };
    }

    if (target.decision !== "applied") {
      if (decisionOutcome(target.decision) !== "accepted") {
        return {
          ok: false as const,
          message:
            "This applicant already has a rejection decision. It was not changed.",
        };
      }

      return { ok: true as const, ...target, newlyAccepted: false };
    }

    const decision: ApplicationDecision =
      getApplicationRound(target.createdAt) === "early"
        ? "early_accepted"
        : "regular_accepted";
    const now = new Date().toISOString();

    await tx
      .update(hackerApplicants)
      .set({ decision, updatedAt: now })
      .where(eq(hackerApplicants.id, target.applicationId));

    return {
      ok: true as const,
      ...target,
      decision,
      newlyAccepted: true,
    };
  });

  if (!accepted.ok) return accepted;

  let emailSent = true;
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
    emailSent = false;
    console.error("Unable to send application decision email:", error);
  }

  revalidatePath("/admin/backdoor");
  revalidatePath("/admin/applications");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/decision");
  revalidatePath("/rsvp");

  if (accepted.newlyAccepted) {
    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: organizer.id,
        event: "backdoor_application_accepted",
        properties: {
          invitation_id: parsed.data.invitationId,
          application_id: accepted.applicationId,
          applicant_user_id: accepted.userId,
          decision: accepted.decision,
          decision_email_sent: emailSent,
        },
      });
      await posthog.flush();
    } catch (error) {
      console.error("Unable to record backdoor application acceptance:", error);
    }
  }

  return {
    ok: true,
    decision: accepted.decision,
    newlyAccepted: accepted.newlyAccepted,
    emailSent,
  };
}

export async function revokeApplicationInvitationAction(
  input: unknown,
): Promise<RevokeApplicationInvitationResult> {
  await requireOrganizer();
  const parsed = revokeApplicationInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid invitation." };

  const [invitation] = await db
    .select({
      id: hackerApplicationInvitations.id,
      email: hackerApplicationInvitations.email,
      expiresAt: hackerApplicationInvitations.expiresAt,
    })
    .from(hackerApplicationInvitations)
    .where(
      and(
        eq(hackerApplicationInvitations.id, parsed.data.id),
        isNull(hackerApplicationInvitations.revokedAt),
      ),
    )
    .limit(1);

  if (!invitation) {
    return { ok: false, message: "Invitation not found or already revoked." };
  }
  if (Date.parse(invitation.expiresAt) <= Date.now()) {
    return { ok: false, message: "Expired invitations cannot be revoked." };
  }

  const [target] = await db
    .select({ applicationId: hackerApplicants.id })
    .from(users)
    .innerJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .where(sql`lower(${users.email}) = ${invitation.email}`)
    .limit(1);
  if (target?.applicationId) {
    return { ok: false, message: "Used invitations cannot be revoked." };
  }

  const now = new Date().toISOString();
  const [revoked] = await db
    .update(hackerApplicationInvitations)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(hackerApplicationInvitations.id, parsed.data.id),
        isNull(hackerApplicationInvitations.revokedAt),
      ),
    )
    .returning({ id: hackerApplicationInvitations.id });

  if (!revoked) {
    return { ok: false, message: "Invitation is no longer active." };
  }

  revalidatePath("/admin/backdoor");
  revalidatePath("/apply");
  revalidatePath("/dashboard");
  return { ok: true, id: revoked.id };
}
