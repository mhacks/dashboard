"use server";

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { huntProgress } from "@/lib/db/schema/hunt";
import { newPetalCode } from "@/lib/hunt/codes";
import { canJoinHunt, getHuntFlower } from "@/lib/queries/hunt";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

/** Petal clicks are cheap to make; this only stops a script hammering it. */
const petalLimiter = drizzleRateLimiter("hunt:petal", 30);
const GENERATE_TRIES = 5;
/**
 * Each wrong flower locks petals for this long: an accidental tap costs 5
 * minutes, and clicking through all five flowers costs up to 20.
 */
const LOCK_MINUTES = 5;

/*
  - found: their flower; `code` is their final code.
  - wrong: a different flower; petals are locked for `minutes`.
  - locked: still locked from an earlier wrong flower, so this click wasn't
    checked; `minutes` until they can try again.
  - none: not taking part (logged out, not checked in, puzzle not unlocked).
    Silent, so visitors clicking flowers on the main page see nothing.

  Wrong and locked say so, rather than nothing: a hacker who mis-tapped and
  then clicked the right flower during the lock would otherwise think the
  right flower was wrong too.
*/
export type PickPetalResult =
  | { status: "found"; code: string }
  | { status: "wrong" | "locked"; minutes: number }
  | { status: "none" };

const NONE: PickPetalResult = { status: "none" };

/** Whole minutes from now until `until`, by the database's clock. */
async function minutesUntil(until: string) {
  const [{ minutes }] = await db.execute<{ minutes: number }>(
    sql`select greatest(1, ceil(extract(epoch from (${until}::timestamptz - now())) / 60))::int as minutes`,
  );
  return minutes;
}

async function issueCode(userId: string): Promise<PickPetalResult> {
  for (let attempt = 0; attempt < GENERATE_TRIES; attempt++) {
    try {
      const [row] = await db
        .update(huntProgress)
        .set({ petalCode: newPetalCode(), petalFoundAt: sql`now()` })
        .where(
          and(eq(huntProgress.userId, userId), isNull(huntProgress.petalCode)),
        )
        .returning({ petalCode: huntProgress.petalCode });
      if (row?.petalCode) return { status: "found", code: row.petalCode };

      // Another click got there first; hand back the code it made.
      const [existing] = await db
        .select({ petalCode: huntProgress.petalCode })
        .from(huntProgress)
        .where(eq(huntProgress.userId, userId))
        .limit(1);
      return existing?.petalCode
        ? { status: "found", code: existing.petalCode }
        : NONE;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return NONE;
}

/**
 * Called when someone clicks a petal on the main page. Gives the hacker their
 * final code for their own flower; a wrong flower locks petals for a while.
 */
export async function pickPetal(flowerId: unknown): Promise<PickPetalResult> {
  const user = await getSessionUser();
  if (!user || typeof flowerId !== "string") return NONE;
  if (await rateLimitMessage(petalLimiter, user.id, "")) return NONE;
  if (!(await canJoinHunt(user))) return NONE;

  const flower = await getHuntFlower(user.id);
  // No flower means no progress row: they haven't redeemed a code yet.
  if (!flower) return NONE;

  const [progress] = await db
    .select({
      petalCode: huntProgress.petalCode,
      lockedUntil: huntProgress.petalLockedUntil,
      locked: sql<boolean>`coalesce(${huntProgress.petalLockedUntil} > now(), false)`,
    })
    .from(huntProgress)
    .where(eq(huntProgress.userId, user.id))
    .limit(1);
  if (!progress) return NONE;

  if (progress.petalCode) {
    // Already found: their flower shows the code again, and nothing else
    // counts against them any more.
    return flower.id === flowerId
      ? { status: "found", code: progress.petalCode }
      : NONE;
  }
  if (progress.locked && progress.lockedUntil) {
    return {
      status: "locked",
      minutes: await minutesUntil(progress.lockedUntil),
    };
  }
  if (flower.id === flowerId) return issueCode(user.id);

  // Only when not already locked, so two quick wrong clicks count once.
  const [missed] = await db
    .update(huntProgress)
    .set({
      petalMisses: sql`${huntProgress.petalMisses} + 1`,
      petalLockedUntil: sql`now() + make_interval(mins => ${LOCK_MINUTES})`,
    })
    .where(
      and(
        eq(huntProgress.userId, user.id),
        isNull(huntProgress.petalCode),
        or(
          isNull(huntProgress.petalLockedUntil),
          lte(huntProgress.petalLockedUntil, sql`now()`),
        ),
      ),
    )
    .returning({ lockedUntil: huntProgress.petalLockedUntil });
  if (!missed?.lockedUntil) return NONE;
  return { status: "wrong", minutes: await minutesUntil(missed.lockedUntil) };
}
