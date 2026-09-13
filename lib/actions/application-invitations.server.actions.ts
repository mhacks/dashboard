"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicationInvitations } from "@/lib/db/schema/application-invitations";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { users } from "@/lib/db/schema/users";
import { sendApplicationInvitationEmail } from "@/lib/email/send-invite-email";
import { getAdminApplicationInvitationById } from "@/lib/queries/application-invitations";
import {
  createApplicationInvitationSchema,
  revokeApplicationInvitationSchema,
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

  const { email, durationHours, note } = parsed.data;
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
      revokedAt: null,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: hackerApplicationInvitations.email,
      set: {
        invitedByUserId: organizer.id,
        expiresAt: expiresAt.toISOString(),
        note,
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
