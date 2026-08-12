import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { rsvpReceiptCleanup } from "@/lib/db/schema/rsvps";
import type { RsvpTransaction } from "@/lib/rsvp/access";
import { rsvpReceiptKeyBelongsToUser } from "@/lib/rsvp/receipt";
import { deleteRsvpReceipt } from "@/lib/rsvp/storage";

function ownedUniqueKeys(userId: string, keys: readonly (string | null)[]) {
  return Array.from(
    new Set(
      keys.filter(
        (key): key is string =>
          key !== null && rsvpReceiptKeyBelongsToUser(key, userId),
      ),
    ),
  );
}

export async function enqueueRsvpReceiptCleanup(
  tx: RsvpTransaction,
  userId: string,
  keys: readonly (string | null)[],
): Promise<string[]> {
  const ownedKeys = ownedUniqueKeys(userId, keys);
  if (ownedKeys.length === 0) return [];
  await tx
    .insert(rsvpReceiptCleanup)
    .values(ownedKeys.map((key) => ({ key, userId })))
    .onConflictDoNothing();
  return ownedKeys;
}

async function recordFailedAttempt(key: string, userId: string): Promise<void> {
  await db
    .insert(rsvpReceiptCleanup)
    .values({
      key,
      userId,
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: rsvpReceiptCleanup.key,
      set: {
        attempts: sql`${rsvpReceiptCleanup.attempts} + 1`,
        lastAttemptAt: new Date().toISOString(),
      },
    });
}

export async function deleteRsvpReceiptOrQueue(
  userId: string,
  key: string,
): Promise<void> {
  if (!rsvpReceiptKeyBelongsToUser(key, userId)) return;
  try {
    await deleteRsvpReceipt(key);
    await db
      .delete(rsvpReceiptCleanup)
      .where(
        and(
          eq(rsvpReceiptCleanup.key, key),
          eq(rsvpReceiptCleanup.userId, userId),
        ),
      );
  } catch {
    await recordFailedAttempt(key, userId);
  }
}

export async function processQueuedRsvpReceiptCleanup(
  userId: string,
  keys?: readonly string[],
): Promise<void> {
  try {
    const ownedKeys = keys ? ownedUniqueKeys(userId, keys) : null;
    if (ownedKeys && ownedKeys.length === 0) return;

    const queued = await db
      .select({ key: rsvpReceiptCleanup.key })
      .from(rsvpReceiptCleanup)
      .where(
        ownedKeys
          ? and(
              eq(rsvpReceiptCleanup.userId, userId),
              inArray(rsvpReceiptCleanup.key, ownedKeys),
            )
          : eq(rsvpReceiptCleanup.userId, userId),
      )
      .limit(20);

    await Promise.all(
      queued.map(async ({ key }) => {
        try {
          await deleteRsvpReceipt(key);
          await db
            .delete(rsvpReceiptCleanup)
            .where(
              and(
                eq(rsvpReceiptCleanup.key, key),
                eq(rsvpReceiptCleanup.userId, userId),
              ),
            );
        } catch {
          try {
            await db
              .update(rsvpReceiptCleanup)
              .set({
                attempts: sql`${rsvpReceiptCleanup.attempts} + 1`,
                lastAttemptAt: new Date().toISOString(),
              })
              .where(
                and(
                  eq(rsvpReceiptCleanup.key, key),
                  eq(rsvpReceiptCleanup.userId, userId),
                ),
              );
          } catch {
            // The durable row already exists; a future action can retry it.
          }
        }
      }),
    );
  } catch {
    // Cleanup is post-commit work. Never make a committed RSVP mutation look
    // failed merely because the retry queue is temporarily unavailable.
  }
}
