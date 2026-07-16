import { z } from "zod";
import { userRole, type UserRole } from "@/lib/db/schema/users";

export const userInviteEmailSchema = z.email();
export const userInviteRoleSchema = z.enum(userRole.enumValues);

export const INVITE_PAGE_SIZE = 10;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  | {
      pendingInvite: {
        id: string;
        role: UserRole;
      };
    }
  | {
      existingUser: {
        role: UserRole;
      };
    };

export function inviteStatus(
  invite: Pick<
    UserInviteListItem,
    "acceptedAt" | "revokedAt" | "expiresAt"
  >,
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

export function canRevokeInvite(
  invite: Pick<
    UserInviteListItem,
    "acceptedAt" | "revokedAt" | "expiresAt"
  >,
) {
  return inviteStatus(invite) === "Pending";
}
