"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  createTeamForUser,
  inviteToTeam as inviteToTeamForUser,
  acceptInvitation as acceptInvitationForUser,
  declineInvitation as declineInvitationForUser,
  cancelInvitation as cancelInvitationForUser,
  leaveTeam as leaveTeamForUser,
  getMyTeam as getMyTeamForUser,
  getMyPendingInvitations as getMyPendingInvitationsForUser,
  getSentInvitations as getSentInvitationsForUser,
} from "@/lib/actions/team.actions";
import { sendTeamInviteEmail } from "@/lib/email/send-invite-email";
import type { TeamRow } from "@/lib/db/schema/teams";
import type {
  TeamWithMembers,
  PendingInvitationSummary,
  SentInvitationSummary,
} from "@/lib/types/teams";

function toActionError(error: unknown, fallback: string): Error {
  console.error(fallback, error);
  return new Error(error instanceof Error ? error.message : fallback);
}

export const createTeam = async (name: string): Promise<TeamRow> => {
  const { id: userId } = await requireSessionUser();
  try {
    const team = await createTeamForUser(userId, name);
    revalidatePath("/dashboard/team");
    return team;
  } catch (error) {
    throw toActionError(error, "Failed to create team");
  }
};

export const inviteToTeam = async (
  email: string,
): Promise<{ id: string; warning?: string }> => {
  const { id: userId } = await requireSessionUser();
  let result;
  try {
    result = await inviteToTeamForUser(userId, email);
    revalidatePath("/dashboard/team");
  } catch (error) {
    throw toActionError(error, "Failed to send invitation");
  }

  const { invitation, invitedEmail, teamName, inviterName } = result;
  try {
    await sendTeamInviteEmail({ email: invitedEmail, teamName, inviterName });
  } catch (error) {
    console.error("Failed to send team invite email", error);
    return {
      id: invitation.id,
      warning: "Invitation sent, but the email could not be sent.",
    };
  }

  return { id: invitation.id };
};

export const acceptInvitation = async (invitationId: string): Promise<void> => {
  const { id: userId } = await requireSessionUser();
  try {
    await acceptInvitationForUser(userId, invitationId);
    revalidatePath("/dashboard/team");
  } catch (error) {
    throw toActionError(error, "Failed to accept invitation");
  }
};

export const declineInvitation = async (
  invitationId: string,
): Promise<void> => {
  const { id: userId } = await requireSessionUser();
  try {
    await declineInvitationForUser(userId, invitationId);
    revalidatePath("/dashboard/team");
  } catch (error) {
    throw toActionError(error, "Failed to decline invitation");
  }
};

export const cancelInvitation = async (invitationId: string): Promise<void> => {
  const { id: userId } = await requireSessionUser();
  try {
    await cancelInvitationForUser(userId, invitationId);
    revalidatePath("/dashboard/team");
  } catch (error) {
    throw toActionError(error, "Failed to cancel invitation");
  }
};

export const leaveTeam = async (): Promise<void> => {
  const { id: userId } = await requireSessionUser();
  try {
    await leaveTeamForUser(userId);
    revalidatePath("/dashboard/team");
  } catch (error) {
    throw toActionError(error, "Failed to leave team");
  }
};

export const getMyTeam = async (): Promise<TeamWithMembers | null> => {
  const { id: userId } = await requireSessionUser();
  return getMyTeamForUser(userId);
};

export const getMyPendingInvitations = async (): Promise<
  PendingInvitationSummary[]
> => {
  const { id: userId } = await requireSessionUser();
  return getMyPendingInvitationsForUser(userId);
};

export const getSentInvitations = async (): Promise<
  SentInvitationSummary[]
> => {
  const { id: userId } = await requireSessionUser();
  return getSentInvitationsForUser(userId);
};
