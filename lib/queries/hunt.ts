import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  huntCodes,
  huntDecoyOrganizers,
  huntProgress,
  huntSettings,
} from "@/lib/db/schema/hunt";
import { users } from "@/lib/db/schema/users";
import { personNameSql } from "@/lib/db/person-name";
import type { UserEntry } from "@/lib/db/schema/users";
import {
  flowerById,
  randomFlowerId,
  type HuntFlower,
} from "@/lib/hunt/flowers";
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
 * The flower this hacker hunts for, or null if they haven't unlocked the
 * hunt. Picked when they redeem a code; a row from before that gets one now,
 * and the `flower is null` guard keeps two racing requests from disagreeing.
 */
export async function getHuntFlower(
  userId: string,
): Promise<HuntFlower | null> {
  const [row] = await db
    .select({ flower: huntProgress.flower })
    .from(huntProgress)
    .where(eq(huntProgress.userId, userId))
    .limit(1);
  if (!row) return null;
  if (row.flower) return flowerById(row.flower);

  await db
    .update(huntProgress)
    .set({ flower: randomFlowerId() })
    .where(and(eq(huntProgress.userId, userId), isNull(huntProgress.flower)));
  const [assigned] = await db
    .select({ flower: huntProgress.flower })
    .from(huntProgress)
    .where(eq(huntProgress.userId, userId))
    .limit(1);
  return flowerById(assigned?.flower ?? null);
}

/** Whether someone has already won, which ends the hunt for everyone. */
export async function isHuntEnded() {
  const [row] = await db
    .select({ endedAt: huntSettings.endedAt })
    .from(huntSettings)
    .limit(1);
  return Boolean(row?.endedAt);
}

/**
 * Ends the hunt with this user as the winner, unless it has already ended.
 * One statement, so of two hackers submitting at once exactly one gets true.
 */
export async function endHuntWithWinner(userId: string) {
  const [row] = await db
    .insert(huntSettings)
    .values({ endedAt: sql`now()`, winnerUserId: userId })
    .onConflictDoUpdate({
      target: huntSettings.id,
      set: {
        endedAt: sql`now()`,
        winnerUserId: userId,
        updatedAt: sql`now()`,
      },
      setWhere: isNull(huntSettings.endedAt),
    })
    .returning({ id: huntSettings.id });
  return Boolean(row);
}

/** The final code this hacker was given, or null if they haven't found it. */
export async function getPetalCode(userId: string) {
  const [row] = await db
    .select({ petalCode: huntProgress.petalCode })
    .from(huntProgress)
    .where(eq(huntProgress.userId, userId))
    .limit(1);
  return row?.petalCode ?? null;
}

export type HuntDecoyCandidate = {
  userId: string;
  name: string;
  email: string;
  decoy: boolean;
};

/** Every organizer, and whether they're a decoy (see huntDecoyOrganizers). */
export async function getHuntDecoyRoster(): Promise<HuntDecoyCandidate[]> {
  const name = personNameSql;
  return db
    .select({
      userId: users.id,
      name,
      email: users.email,
      decoy: sql<boolean>`${huntDecoyOrganizers.userId} is not null`,
    })
    .from(users)
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .leftJoin(huntDecoyOrganizers, eq(huntDecoyOrganizers.userId, users.id))
    .where(eq(users.role, "organizer"))
    .orderBy(asc(name));
}
