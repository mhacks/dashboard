import { z } from "zod";
import { type UserRole } from "@/lib/db/schema/users";

export const INVITABLE_USER_ROLES = [
  "organizer",
  "volunteer",
  "judge",
  "hacker",
] as const satisfies readonly UserRole[];
export type InvitableUserRole = (typeof INVITABLE_USER_ROLES)[number];

export const userInviteEmailSchema = z.email();
export const userInviteRoleSchema = z.enum(INVITABLE_USER_ROLES);

export const INVITE_PAGE_SIZE = 10;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const INVITE_SYNC_CHANNEL = "user-invites:dashboard";
export const INVITE_SYNC_EVENT = "invites_updated";

export const inviteSyncPayloadSchema = z.object({
  sourceUserId: z.uuid(),
});

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function inviteExpiresAt(from = new Date()) {
  return new Date(from.getTime() + INVITE_TTL_MS);
}

export type UserInviteListItem = {
  id: string;
  email: string;
  role: UserRole;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  invitedByEmail: string;
};

export type UserInviteListResult = {
  items: UserInviteListItem[];
  totalCount: number;
};

export type CreateUserInviteResult =
  | { error: string }
  | { warning: string }
  | {
      pendingInvite: {
        role: UserRole;
      };
    }
  | {
      existingUser: {
        role: UserRole;
      };
    };

export function inviteStatus(
  invite: Pick<UserInviteListItem, "acceptedAt" | "revokedAt" | "expiresAt">,
) {
  if (invite.acceptedAt) return "Accepted";
  if (invite.revokedAt) return "Revoked";
  const expiresAt =
    invite.expiresAt instanceof Date
      ? invite.expiresAt
      : new Date(invite.expiresAt);
  if (expiresAt.getTime() <= Date.now()) return "Expired";
  return "Pending";
}
