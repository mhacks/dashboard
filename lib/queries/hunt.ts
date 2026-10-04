import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { discordAccounts } from "@/lib/db/schema/discord";
import { huntCodes, huntProgress } from "@/lib/db/schema/hunt";
import type { UserEntry } from "@/lib/db/schema/users";
import { findOrganizerAccess } from "@/lib/queries/organizer-locations";

/** Postgres text timestamps parse in Node but not Safari; send ISO. */
const toIso = (timestamp: string) => new Date(timestamp).toISOString();

export type IssuedHuntCode = {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
};

export type IssuedHuntCodes = {
  codes: IssuedHuntCode[];
  /** Server time of the read, so countdowns don't trust the viewer's clock. */
  readAt: string;
};

/** The organizer's most recent codes, newest first. */
export async function getIssuedHuntCodes(
  organizerId: string,
  limit = 8,
): Promise<IssuedHuntCodes> {
  const [rows, [{ now }]] = await Promise.all([
    db
      .select({
        id: huntCodes.id,
        code: huntCodes.code,
        createdAt: huntCodes.createdAt,
        expiresAt: huntCodes.expiresAt,
        redeemedAt: huntCodes.redeemedAt,
      })
      .from(huntCodes)
      .where(eq(huntCodes.organizerId, organizerId))
      .orderBy(desc(huntCodes.createdAt))
      .limit(limit),
    db.execute<{ now: string }>(sql`select now()::text as now`),
  ]);

  return {
    codes: rows.map((row) => ({
      ...row,
      createdAt: toIso(row.createdAt),
      expiresAt: toIso(row.expiresAt),
      redeemedAt: row.redeemedAt ? toIso(row.redeemedAt) : null,
    })),
    readAt: toIso(now),
  };
}

/**
 * Only checked-in hackers take part: the same people who can see the map,
 * minus volunteers and judges, who are staff.
 */
export async function canJoinHunt(user: UserEntry) {
  return (
    user.role === "hacker" && (await findOrganizerAccess(user)) === "attendee"
  );
}

export async function hasUnlockedHunt(userId: string) {
  const [row] = await db
    .select({ userId: huntProgress.userId })
    .from(huntProgress)
    .where(eq(huntProgress.userId, userId))
    .limit(1);
  return Boolean(row);
}

/**
 * The Discord account this hacker linked through the bot's Verify button.
 * The bot derives each hacker's /unlock key from it, so the puzzle can't hand
 * out a key until it exists.
 */
export async function getLinkedDiscordId(userId: string) {
  const [row] = await db
    .select({ discordUserId: discordAccounts.discordUserId })
    .from(discordAccounts)
    .where(eq(discordAccounts.userId, userId))
    .limit(1);
  return row?.discordUserId ?? null;
}
