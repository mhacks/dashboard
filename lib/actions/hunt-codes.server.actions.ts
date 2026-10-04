"use server";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer, requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { huntCodes, huntProgress } from "@/lib/db/schema/hunt";
import {
  HUNT_CODE_TTL_MINUTES,
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
  isHuntCodeShape,
  newHuntCode,
} from "@/lib/hunt/codes";
import { canJoinHunt, hasUnlockedHunt } from "@/lib/queries/hunt";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

const ADMIN_PATH = "/admin/hunt-codes";
/** Collisions need two open codes out of a million; a few retries is plenty. */
const GENERATE_TRIES = 5;

const redeemLimiter = drizzleRateLimiter(
  "hunt:redeem",
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
);

/* Errors are returned rather than thrown: production builds replace a thrown
   server-action message with a generic digest. */
export type GenerateHuntCodeResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; message: string };

export async function generateHuntCode(): Promise<GenerateHuntCodeResult> {
  const organizer = await requireOrganizer();

  // Expired codes nobody used free up their digits for new ones.
  await db
    .delete(huntCodes)
    .where(
      and(isNull(huntCodes.redeemedBy), lt(huntCodes.expiresAt, sql`now()`)),
    );

  for (let attempt = 0; attempt < GENERATE_TRIES; attempt++) {
    try {
      const [row] = await db
        .insert(huntCodes)
        .values({
          organizerId: organizer.id,
          code: newHuntCode(),
          expiresAt: sql`now() + make_interval(mins => ${HUNT_CODE_TTL_MINUTES})`,
        })
        .returning({ code: huntCodes.code, expiresAt: huntCodes.expiresAt });
      revalidatePath(ADMIN_PATH);
      return {
        ok: true,
        code: row.code,
        expiresAt: new Date(row.expiresAt).toISOString(),
      };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return { ok: false, message: "Couldn't make a code. Try again." };
}

export type RedeemHuntCodeResult =
  { ok: true } | { ok: false; message: string };

export async function redeemHuntCode(
  input: unknown,
): Promise<RedeemHuntCodeResult> {
  const user = await requireSessionUser();
  if (!(await canJoinHunt(user))) {
    return {
      ok: false,
      message: "The hunt opens to hackers once they've checked in.",
    };
  }
  // Already in: no need to spend an organizer's code or an attempt.
  if (await hasUnlockedHunt(user.id)) return { ok: true };

  const blocked = await rateLimitMessage(
    redeemLimiter,
    user.id,
    "Too many tries. Wait a few minutes, then ask the organizer for a new code.",
  );
  if (blocked) return { ok: false, message: blocked };

  // Server actions take whatever the caller posts, not what the type says.
  const code = typeof input === "string" ? input.replace(/\s/g, "") : input;
  if (!isHuntCodeShape(code)) {
    return { ok: false, message: "Codes are 6 digits." };
  }

  const redeemed = await db.transaction(async (tx) => {
    // One statement, so two hackers racing for the same code can't both win.
    const [row] = await tx
      .update(huntCodes)
      .set({ redeemedBy: user.id, redeemedAt: sql`now()` })
      .where(
        and(
          eq(huntCodes.code, code),
          isNull(huntCodes.redeemedBy),
          gt(huntCodes.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: huntCodes.id });
    if (!row) return false;

    await tx
      .insert(huntProgress)
      .values({ userId: user.id, codeId: row.id })
      .onConflictDoNothing();
    return true;
  });

  if (!redeemed) {
    return {
      ok: false,
      message: `That code didn't work. It may be mistyped, already used, or more than ${HUNT_CODE_TTL_MINUTES} minutes old.`,
    };
  }
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
