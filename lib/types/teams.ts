import { z } from "zod";
import type { TeamRow, TeamInvitationStatus } from "@/lib/db/schema/teams";

export const MAX_TEAM_SIZE = 4;

export const TEAM_NAME_MAX_LENGTH = 30;

export const teamNameSchema = z
  .string()
  .trim()
  .min(1, "Team name is required")
  .max(
    TEAM_NAME_MAX_LENGTH,
    `Team name must be ${TEAM_NAME_MAX_LENGTH} characters or fewer`,
  );

export const TEAM_RENAME_REASON_MAX_LENGTH = 200;

export const teamRenameReasonSchema = z
  .string()
  .trim()
  .max(
    TEAM_RENAME_REASON_MAX_LENGTH,
    `Reason must be ${TEAM_RENAME_REASON_MAX_LENGTH} characters or fewer`,
  )
  .optional();

export const inviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

const DEVPOST_URL_MAX_LENGTH = 2048;

export const devpostUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter a Devpost link")
  .max(DEVPOST_URL_MAX_LENGTH, "That link is too long")
  .refine((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      return (
        url.protocol === "https:" &&
        (host === "devpost.com" || host.endsWith(".devpost.com"))
      );
    } catch {
      return false;
    }
  }, "Enter a Devpost link, like https://devpost.com/software/your-project");

// `users` has no name column — display name is best-effort, derived from a
// submitted application's firstName/lastName when one exists (a hacker can
// have a team before finishing their application), falling back to email.
export type TeamMemberSummary = {
  userId: string;
  email: string;
  name: string | null;
  joinedAt: string;
};

/**
 * The team fields a member's browser receives. Deliberately not TeamRow: that
 * carries renameRequestedByUserId, and a user's id doubles as their check-in
 * QR code, so it must not reach the team an organizer asked to rename.
 */
export type MemberTeam = Pick<
  TeamRow,
  "id" | "name" | "createdAt" | "renameRequestedAt" | "renameRequestReason"
>;

export type TeamWithMembers = {
  team: MemberTeam;
  members: TeamMemberSummary[];
};

export type PendingInvitationSummary = {
  id: string;
  teamId: string;
  teamName: string;
  /** The team holds a table, so this invite stays usable after registration closes. */
  teamHasTable: boolean;
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

export type RenameRequestSummary = {
  requestedAt: string;
  reason: string | null;
  requestedByName: string | null;
};

export type AdminTeamSummary = {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMemberSummary[];
  pendingInviteCount: number;
  renameRequest: RenameRequestSummary | null;
  devpostUrl: string | null;
};
