"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  pendingInviteForEmail,
  userInvitations,
} from "@/lib/db/schema/user-invitations";
import { users, type UserRole } from "@/lib/db/schema/users";
import { sendInviteEmail } from "@/lib/email/send-invite-email";
import {
  getPendingUserInvite as getPendingUserInviteQuery,
  INVITE_PAGE_SIZE,
  listUserInvites as listUserInvitesQuery,
} from "@/lib/queries/user-invitations";
import {
  type CreateUserInviteResult,
  inviteExpiresAt,
  normalizeInviteEmail,
  userInviteEmailSchema,
  userInviteRoleSchema,
} from "@/lib/types/user-invitations";

export { INVITE_PAGE_SIZE };

export async function listUserInvites(
  pageIndex?: number,
  pageSize?: number,
  search?: string,
) {
  return listUserInvitesQuery(pageIndex, pageSize, search);
}

export async function getPendingUserInvite(email: string) {
  return getPendingUserInviteQuery(email);
}

export async function createUserInvite(
  email: string,
  role: UserRole,
  options?: { replacePendingInvite?: boolean },
): Promise<CreateUserInviteResult | undefined> {
  const organizer = await requireOrganizer();
  const normalizedEmail = normalizeInviteEmail(email);
  const parsedEmail = userInviteEmailSchema.safeParse(normalizedEmail);
  const parsedRole = userInviteRoleSchema.safeParse(role);
  if (!parsedEmail.success) {
    return { error: "Please enter a valid email address." };
  }
  if (!parsedRole.success) {
    return { error: "Please choose a valid role." };
  }

  const inviteRole = parsedRole.data;
  const expiresAt = inviteExpiresAt();
  const replacePendingInvite = options?.replacePendingInvite ?? false;

  const [[existingUser], [pendingInvite]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1),
    db
      .select({
        id: userInvitations.id,
        role: userInvitations.role,
      })
      .from(userInvitations)
      .where(pendingInviteForEmail(normalizedEmail))
      .limit(1),
  ]);

  if (existingUser?.role === inviteRole) {
    return { error: `This user already has the ${inviteRole} role.` };
  }

  if (pendingInvite && !replacePendingInvite) {
    return { pendingInvite };
  }

  if (existingUser) {
    const acceptedAt = new Date();

    await db.transaction(async (tx) => {
      if (pendingInvite) {
        await tx
          .update(userInvitations)
          .set({ revokedAt: new Date() })
          .where(eq(userInvitations.id, pendingInvite.id));
      }

      await tx
        .update(users)
        .set({ role: inviteRole })
        .where(eq(users.id, existingUser.id));

      await tx.insert(userInvitations).values({
        email: normalizedEmail,
        role: inviteRole,
        invitedBy: organizer.id,
        acceptedAt,
        expiresAt: inviteExpiresAt(acceptedAt),
      });
    });

    try {
      await sendInviteEmail(normalizedEmail, inviteRole);
    } catch {
      return { error: "Role updated, but the notification email could not be sent." };
    }

    return;
  }

  if (pendingInvite) {
    await db.transaction(async (tx) => {
      await tx
        .update(userInvitations)
        .set({ revokedAt: new Date() })
        .where(eq(userInvitations.id, pendingInvite.id));

      await tx.insert(userInvitations).values({
        email: normalizedEmail,
        role: inviteRole,
        invitedBy: organizer.id,
        expiresAt,
      });
    });
  } else {
    await db.insert(userInvitations).values({
      email: normalizedEmail,
      role: inviteRole,
      invitedBy: organizer.id,
      expiresAt,
    });
  }

  try {
    await sendInviteEmail(normalizedEmail, inviteRole);
  } catch {
    return { error: "Invite created, but the email could not be sent." };
  }
}

export async function revokeUserInvite(
  inviteId: string,
): Promise<{ error: string } | undefined> {
  await requireOrganizer();

  const parsedId = z.uuid().safeParse(inviteId);
  if (!parsedId.success) {
    return { error: "Invalid invite." };
  }

  const [invite] = await db
    .select({
      id: userInvitations.id,
      acceptedAt: userInvitations.acceptedAt,
      revokedAt: userInvitations.revokedAt,
      expiresAt: userInvitations.expiresAt,
    })
    .from(userInvitations)
    .where(eq(userInvitations.id, parsedId.data))
    .limit(1);

  if (!invite) {
    return { error: "Invite not found." };
  }

  if (invite.acceptedAt) {
    return { error: "Accepted invites cannot be revoked." };
  }

  if (invite.revokedAt) {
    return { error: "Invite is already revoked." };
  }

  const expiresAt =
    invite.expiresAt instanceof Date
      ? invite.expiresAt
      : new Date(invite.expiresAt);

  if (expiresAt.getTime() <= Date.now()) {
    return { error: "Expired invites cannot be revoked." };
  }

  await db
    .update(userInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(userInvitations.id, parsedId.data));
}
