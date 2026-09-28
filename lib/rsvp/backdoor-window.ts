import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerRsvpExceptions } from "@/lib/db/schema/rsvps";

type RsvpTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const BACKDOOR_RSVP_WINDOW_HOURS = 24;

/**
 * Gives a backdoor admit enough time to RSVP after their decision is released.
 *
 * The unique user_id constraint makes this safe to retry. An already-active
 * exception keeps its original deadline; an absent, expired, or revoked one is
 * opened for a fresh 24 hours. That lets the manual decision resend repair
 * admits affected by the old flow without extending a window on every click.
 */
export async function ensureBackdoorRsvpWindow(
  tx: RsvpTransaction,
  {
    userId,
    createdByUserId,
    now = new Date(),
  }: {
    userId: string;
    createdByUserId: string;
    now?: Date;
  },
): Promise<{ closesAt: string; opened: boolean }> {
  const nowIso = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + BACKDOOR_RSVP_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const note = "Automatically opened after Backdoor acceptance";

  const [existing] = await tx
    .select({
      expiresAt: hackerRsvpExceptions.expiresAt,
      revokedAt: hackerRsvpExceptions.revokedAt,
    })
    .from(hackerRsvpExceptions)
    .where(eq(hackerRsvpExceptions.userId, userId))
    .limit(1)
    .for("update");

  if (
    existing &&
    existing.revokedAt === null &&
    Date.parse(existing.expiresAt) > now.getTime()
  ) {
    return { closesAt: existing.expiresAt, opened: false };
  }

  const [saved] = await tx
    .insert(hackerRsvpExceptions)
    .values({
      userId,
      createdByUserId,
      expiresAt,
      note,
      revokedAt: null,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: hackerRsvpExceptions.userId,
      set: {
        createdByUserId,
        expiresAt,
        note,
        revokedAt: null,
        updatedAt: nowIso,
      },
    })
    .returning({
      closesAt: hackerRsvpExceptions.expiresAt,
    });

  if (!saved) throw new Error("Unable to open the backdoor RSVP window");
  return { ...saved, opened: true };
}
