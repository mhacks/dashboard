"use server";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer, requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  huntCodes,
  huntDecoyOrganizers,
  huntProgress,
} from "@/lib/db/schema/hunt";
import { users } from "@/lib/db/schema/users";
import {
  DECOY_LOCKOUT_MINUTES,
  HUNT_CODE_TTL_MINUTES,
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
  isHuntCodeShape,
  newHuntCode,
} from "@/lib/hunt/codes";
import { randomFlowerId } from "@/lib/hunt/flowers";
import { canJoinHunt, hasUnlockedHunt, isHuntEnded } from "@/lib/queries/hunt";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

const ADMIN_PATH = "/admin/hunt-codes";
/** Collisions need two open codes out of a million; a few retries is plenty. */
const GENERATE_TRIES = 5;

const redeemLimiter = drizzleRateLimiter(
  "hunt:redeem",
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
);

/**
 * Temporary (see huntDecoyOrganizers): a hacker who redeems a decoy
 * organizer's code is blocked here for DECOY_LOCKOUT_MINUTES. Kept in the
 * rate limiter's table so it needs no migration and expires on its own.
 */
const decoyLockout = drizzleRateLimiter(
  "hunt:decoy",
  1,
  DECOY_LOCKOUT_MINUTES * 60,
);

/** Whole minutes left on this hacker's decoy lockout, or 0 if none. */
async function decoyMinutesLeft(userId: string) {
  const res = await decoyLockout.get(userId);
  if (!res || res.consumedPoints <= 1 || res.msBeforeNext <= 0) return 0;
  return Math.max(1, Math.ceil(res.msBeforeNext / 60_000));
}

const minutes = (n: number) => `${n} minute${n === 1 ? "" : "s"}`;

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
  if (await isHuntEnded()) {
    return {
      ok: false,
      message: "The scavenger hunt has ended. Thanks for playing!",
    };
  }

  const lockedFor = await decoyMinutesLeft(user.id);
  if (lockedFor) {
    return {
      ok: false,
      message: `You're still locked out for using the wrong organizer's code. Try again in ${minutes(lockedFor)}.`,
    };
  }

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
      .returning({ id: huntCodes.id, organizerId: huntCodes.organizerId });
    if (!row) return "invalid";

    // A decoy's code is used up like any other, but unlocks nothing.
    const [decoy] = await tx
      .select({ userId: huntDecoyOrganizers.userId })
      .from(huntDecoyOrganizers)
      .where(eq(huntDecoyOrganizers.userId, row.organizerId))
      .limit(1);
    if (decoy) return "decoy";

    await tx
      .insert(huntProgress)
      .values({ userId: user.id, codeId: row.id, flower: randomFlowerId() })
      .onConflictDoNothing();
    return "ok";
  });

  if (redeemed === "decoy") {
    await decoyLockout.block(user.id, DECOY_LOCKOUT_MINUTES * 60);
    revalidatePath(ADMIN_PATH);
    return {
      ok: false,
      message: `Wrong organizer! That code was a trap. You're locked out for ${minutes(DECOY_LOCKOUT_MINUTES)}, then find the right organizer.`,
    };
  }
  if (redeemed === "invalid") {
    return {
      ok: false,
      message: `That code didn't work. It may be mistyped, already used, or more than ${HUNT_CODE_TTL_MINUTES} minutes old.`,
    };
  }
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

const DECOYS_PATH = "/admin/hunt-codes/decoys";

export type SetHuntDecoyResult = { ok: true } | { ok: false; message: string };

/** Temporary: marks an organizer as a decoy, or not. */
export async function setHuntDecoy(
  userId: unknown,
  decoy: unknown,
): Promise<SetHuntDecoyResult> {
  const organizer = await requireOrganizer();
  if (
    typeof userId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    typeof decoy !== "boolean"
  ) {
    return { ok: false, message: "Couldn't update that organizer." };
  }

  if (decoy) {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (target?.role !== "organizer") {
      return { ok: false, message: "Only organizers can be decoys." };
    }
    await db
      .insert(huntDecoyOrganizers)
      .values({ userId, addedByUserId: organizer.id })
      .onConflictDoNothing();
  } else {
    await db
      .delete(huntDecoyOrganizers)
      .where(eq(huntDecoyOrganizers.userId, userId));
  }
  revalidatePath(DECOYS_PATH);
  return { ok: true };
}
