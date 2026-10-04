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
import { lockHuntMap } from "@/lib/hunt/decoy-lockout";
import { randomFlowerId } from "@/lib/hunt/flowers";
import { canJoinHunt, hasUnlockedHunt, isHuntEnded } from "@/lib/queries/hunt";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

const ADMIN_PATH = "/admin/hunt-codes";
const FIND_PATH = "/find-my-organizer";
/** Collisions need two open codes out of a million; a few retries is plenty. */
const GENERATE_TRIES = 5;

const redeemLimiter = drizzleRateLimiter(
  "hunt:redeem",
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
);

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
    await lockHuntMap(user.id);
    revalidatePath(ADMIN_PATH);
    revalidatePath(FIND_PATH);
    return {
      ok: false,
      message: `Wrong organizer! That code was a trap. The map is hidden for ${minutes(DECOY_LOCKOUT_MINUTES)}, so you'll have to find the right one without it.`,
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
