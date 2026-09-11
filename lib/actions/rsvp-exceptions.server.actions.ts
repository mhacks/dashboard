"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer } from "@/lib/auth/guards";
import { decisionOutcome } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvpExceptions, hackerRsvps } from "@/lib/db/schema/rsvps";
import { users } from "@/lib/db/schema/users";
import { getAdminRsvpExceptionById } from "@/lib/queries/rsvp-exceptions";
import {
  createRsvpExceptionSchema,
  revokeRsvpExceptionSchema,
  type CreateRsvpExceptionResult,
  type RevokeRsvpExceptionResult,
} from "@/lib/types/rsvp-exceptions";

export async function createRsvpExceptionAction(
  input: unknown,
): Promise<CreateRsvpExceptionResult> {
  const organizer = await requireOrganizer();
  const parsed = createRsvpExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter an email and a duration between 1 hour and 30 days.",
    };
  }

  const { email, durationHours, note } = parsed.data;
  const [target] = await db
    .select({
      userId: users.id,
      applicationId: hackerApplicants.id,
      decision: hackerApplicants.decision,
      finalRsvpId: hackerRsvps.id,
    })
    .from(users)
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, users.id))
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!target) {
    return { ok: false, message: "No account exists for that email yet." };
  }
  if (!target.applicationId || !target.decision) {
    return {
      ok: false,
      message:
        "That account does not have a submitted application. Non-applicant backdoor support is still a later flow.",
    };
  }
  if (decisionOutcome(target.decision) !== "accepted") {
    return {
      ok: false,
      message: "That applicant is not accepted, so they cannot RSVP yet.",
    };
  }
  if (target.finalRsvpId) {
    return {
      ok: false,
      message: "That applicant already has a submitted RSVP.",
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  const [saved] = await db
    .insert(hackerRsvpExceptions)
    .values({
      userId: target.userId,
      createdByUserId: organizer.id,
      expiresAt: expiresAt.toISOString(),
      note,
      revokedAt: null,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: hackerRsvpExceptions.userId,
      set: {
        createdByUserId: organizer.id,
        expiresAt: expiresAt.toISOString(),
        note,
        revokedAt: null,
        updatedAt: now.toISOString(),
      },
    })
    .returning({ id: hackerRsvpExceptions.id });

  const exception = saved ? await getAdminRsvpExceptionById(saved.id) : null;
  if (!exception) {
    return { ok: false, message: "Unable to load the saved exception." };
  }

  revalidatePath("/admin/backdoor");
  revalidatePath("/admin/rsvps");
  revalidatePath("/rsvp");
  return { ok: true, exception };
}

export async function revokeRsvpExceptionAction(
  input: unknown,
): Promise<RevokeRsvpExceptionResult> {
  await requireOrganizer();
  const parsed = revokeRsvpExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid exception." };
  }

  const now = new Date().toISOString();
  const [revoked] = await db
    .update(hackerRsvpExceptions)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(hackerRsvpExceptions.id, parsed.data.id),
        isNull(hackerRsvpExceptions.revokedAt),
      ),
    )
    .returning({ id: hackerRsvpExceptions.id });

  if (!revoked) {
    return { ok: false, message: "Exception not found or already revoked." };
  }

  revalidatePath("/admin/backdoor");
  revalidatePath("/admin/rsvps");
  revalidatePath("/rsvp");
  return { ok: true, id: revoked.id };
}
