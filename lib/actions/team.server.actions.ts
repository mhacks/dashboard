"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  createTeamForUser,
  renameTeam as renameTeamForUser,
  inviteToTeam as inviteToTeamForUser,
  acceptInvitation as acceptInvitationForUser,
  declineInvitation as declineInvitationForUser,
  cancelInvitation as cancelInvitationForUser,
  leaveTeam as leaveTeamForUser,
  getMyTeam as getMyTeamForUser,
  getMyPendingInvitations as getMyPendingInvitationsForUser,
  getSentInvitations as getSentInvitationsForUser,
  saveTeamDevpostUrl as saveTeamDevpostUrlForUser,
} from "@/lib/actions/team.actions";
import { sendTeamInviteEmail } from "@/lib/email/send-invite-email";
import { revalidateReservationPaths } from "@/lib/reservation/revalidate";
import { hasCheckedIn } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import type {
  TeamWithMembers,
  PendingInvitationSummary,
  SentInvitationSummary,
} from "@/lib/types/teams";

// Failures are returned rather than thrown: Next replaces a thrown server
// action error's message with a generic one in production builds.
export type TeamActionResult =
  { ok: true; warning?: string } | { ok: false; error: string };

function teamActionFailure(
  error: unknown,
  fallback: string,
): Extract<TeamActionResult, { ok: false }> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? fallback };
  }
  // The core functions throw plain Errors with messages meant for the
  // hacker; anything else is unexpected and stays generic.
  if (error instanceof Error && error.constructor === Error) {
    return { ok: false, error: error.message };
  }
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

/** Reads are not covered by the mutation checks in team.actions. */
async function assertCallerCheckedIn(userId: string): Promise<void> {
  const [application] = await db
    .select({ decision: hackerApplicants.decision })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);

  if (!application || !hasCheckedIn(application.decision)) {
    throw new Error("Check in at MHacks before managing a team.");
  }
}

export const createTeam = async (name: string): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await createTeamForUser(userId, name);
    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to create team");
  }
};

export const inviteToTeam = async (
  email: string,
): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  let result;
  try {
    result = await inviteToTeamForUser(userId, email);
    revalidatePath("/dashboard/team");
  } catch (error) {
    return teamActionFailure(error, "Failed to send invitation");
  }

  const { invitedEmail, teamName, inviterName } = result;
  try {
    await sendTeamInviteEmail({ email: invitedEmail, teamName, inviterName });
  } catch (error) {
    console.error("Failed to send team invite email", error);
    return {
      ok: true,
      warning: "Invitation sent, but the email could not be sent.",
    };
  }

  return { ok: true };
};

export const acceptInvitation = async (
  invitationId: string,
): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await acceptInvitationForUser(userId, invitationId);
    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to accept invitation");
  }
};

export const declineInvitation = async (
  invitationId: string,
): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await declineInvitationForUser(userId, invitationId);
    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to decline invitation");
  }
};

export const cancelInvitation = async (
  invitationId: string,
): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await cancelInvitationForUser(userId, invitationId);
    revalidatePath("/dashboard/team");
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to cancel invitation");
  }
};

export const renameTeam = async (name: string): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await renameTeamForUser(userId, name);
    revalidatePath("/dashboard/team");
    revalidatePath("/admin/teams");
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to rename team");
  }
};

export const leaveTeam = async (): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await leaveTeamForUser(userId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/team");
    revalidateReservationPaths();
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to leave team");
  }
};

export const getMyTeam = async (): Promise<TeamWithMembers | null> => {
  const { id: userId } = await requireSessionUser();
  await assertCallerCheckedIn(userId);
  return getMyTeamForUser(userId);
};

export const getMyPendingInvitations = async (): Promise<
  PendingInvitationSummary[]
> => {
  const { id: userId } = await requireSessionUser();
  await assertCallerCheckedIn(userId);
  return getMyPendingInvitationsForUser(userId);
};

export const getSentInvitations = async (): Promise<
  SentInvitationSummary[]
> => {
  const { id: userId } = await requireSessionUser();
  await assertCallerCheckedIn(userId);
  return getSentInvitationsForUser(userId);
};

export const saveTeamDevpostUrl = async (
  url: string,
): Promise<TeamActionResult> => {
  const { id: userId } = await requireSessionUser();
  try {
    await saveTeamDevpostUrlForUser(userId, url);
    revalidatePath("/dashboard/team");
    revalidatePath("/admin/teams");
    return { ok: true };
  } catch (error) {
    return teamActionFailure(error, "Failed to save your Devpost link");
  }
};
