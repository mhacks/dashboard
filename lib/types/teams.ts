import { z } from "zod";
import type { TeamRow, TeamInvitationStatus } from "@/lib/db/schema/teams";

export const MAX_TEAM_SIZE = 4;

export const teamNameSchema = z
  .string()
  .trim()
  .min(1, "Team name is required")
  .max(60, "Team name must be 60 characters or fewer");

export const inviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

// `users` has no name column — display name is best-effort, derived from a
// submitted application's firstName/lastName when one exists (a hacker can
// have a team before finishing their application), falling back to email.
export type TeamMemberSummary = {
  userId: string;
  email: string;
  name: string | null;
  joinedAt: string;
};

export type TeamWithMembers = {
  team: TeamRow;
  members: TeamMemberSummary[];
};

export type PendingInvitationSummary = {
  id: string;
  teamId: string;
  teamName: string;
  invitedByName: string;
  createdAt: string;
};

export type SentInvitationSummary = {
  id: string;
  invitedEmail: string;
  invitedName: string | null;
  status: TeamInvitationStatus;
  createdAt: string;
  respondedAt: string | null;
};
