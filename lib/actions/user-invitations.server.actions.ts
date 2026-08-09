"use server";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  pendingInviteForEmail,
  userInvitations,
} from "@/lib/db/schema/user-invitations";
import { users } from "@/lib/db/schema/users";
import {
  sendInviteEmail,
  sendRoleChangeEmail,
} from "@/lib/email/send-invite-email";
import { listUserInvites as listUserInvitesQuery } from "@/lib/queries/user-invitations";
import {
  type CreateUserInviteResult,
  type InvitableUserRole,
  inviteExpiresAt,
  inviteStatus,
  normalizeInviteEmail,
  userInviteEmailSchema,
  userInviteRoleSchema,
} from "@/lib/types/user-invitations";

export async function listUserInvites(
  pageIndex?: number,
  pageSize?: number,
  search?: string,
) {
  return listUserInvitesQuery(pageIndex, pageSize, search);
}

export async function createUserInvite(
  email: string,
  role: InvitableUserRole,
  options?: {
    replacePendingInvite?: boolean;
    changeExistingUserRole?: boolean;
  },
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
  const changeExistingUserRole = options?.changeExistingUserRole ?? false;

  if (normalizeInviteEmail(organizer.email) === normalizedEmail) {
    return { error: "You cannot change your own role." };
  }

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
      .orderBy(desc(userInvitations.createdAt))
      .limit(1),
  ]);

  if (existingUser?.role === inviteRole) {
    return { error: `This user already has the ${inviteRole} role.` };
  }

  if (existingUser && !changeExistingUserRole) {
    return { existingUser: { role: existingUser.role } };
  }

  if (!existingUser && pendingInvite && !replacePendingInvite) {
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
      await sendRoleChangeEmail(normalizedEmail, inviteRole);
    } catch {
      return {
        error: "Role updated, but the notification email could not be sent.",
      };
    }

    return;
  }

  const newInvite = {
    email: normalizedEmail,
    role: inviteRole,
    invitedBy: organizer.id,
    expiresAt,
  };

  if (pendingInvite) {
    await db.transaction(async (tx) => {
      await tx
        .update(userInvitations)
        .set({ revokedAt: new Date() })
        .where(eq(userInvitations.id, pendingInvite.id));

      await tx.insert(userInvitations).values(newInvite);
    });
  } else {
    await db.insert(userInvitations).values(newInvite);
  }

  try {
    await sendInviteEmail(normalizedEmail, inviteRole, expiresAt);
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

  switch (inviteStatus(invite)) {
    case "Accepted":
      return { error: "Accepted invites cannot be revoked." };
    case "Revoked":
      return { error: "Invite is already revoked." };
    case "Expired":
      return { error: "Expired invites cannot be revoked." };
  }

  await db
    .update(userInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(userInvitations.id, parsedId.data));
}
