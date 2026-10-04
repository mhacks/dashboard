"use server";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { huntProgress } from "@/lib/db/schema/hunt";
import { newPetalCode } from "@/lib/hunt/codes";
import { assignedFlower } from "@/lib/hunt/flowers";
import { canJoinHunt } from "@/lib/queries/hunt";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

/** Petal clicks are cheap to make; this only stops a script hammering it. */
const petalLimiter = drizzleRateLimiter("hunt:petal", 30);
const GENERATE_TRIES = 5;

/*
  Every miss looks the same: not signed in, not in the hunt, puzzle not
  unlocked, or the wrong flower. Telling them apart would let a hacker click
  every flower to learn which one is theirs.
*/
export type PickPetalResult = { code: string } | { code: null };
const MISS: PickPetalResult = { code: null };

/**
 * Called when someone clicks a petal on the main page. Returns the hacker's
 * final code if it is their assigned flower, making it on the first find.
 */
export async function pickPetal(flowerId: unknown): Promise<PickPetalResult> {
  const user = await getSessionUser();
  if (!user || typeof flowerId !== "string") return MISS;
  if (await rateLimitMessage(petalLimiter, user.id, "")) return MISS;
  if (!(await canJoinHunt(user))) return MISS;

  const [progress] = await db
    .select({ petalCode: huntProgress.petalCode })
    .from(huntProgress)
    .where(eq(huntProgress.userId, user.id))
    .limit(1);
  // No row means they haven't redeemed an organizer's code yet.
  if (!progress) return MISS;
  if (assignedFlower(user.id).id !== flowerId) return MISS;
  if (progress.petalCode) return { code: progress.petalCode };

  for (let attempt = 0; attempt < GENERATE_TRIES; attempt++) {
    try {
      const [row] = await db
        .update(huntProgress)
        .set({ petalCode: newPetalCode(), petalFoundAt: sql`now()` })
        .where(
          and(eq(huntProgress.userId, user.id), isNull(huntProgress.petalCode)),
        )
        .returning({ petalCode: huntProgress.petalCode });
      if (row?.petalCode) return { code: row.petalCode };

      // Another click got there first; hand back the code it made.
      const [existing] = await db
        .select({ petalCode: huntProgress.petalCode })
        .from(huntProgress)
        .where(eq(huntProgress.userId, user.id))
        .limit(1);
      return existing?.petalCode ? { code: existing.petalCode } : MISS;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return MISS;
}
