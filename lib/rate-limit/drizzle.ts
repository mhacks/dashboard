import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import {
  RateLimiterDrizzle,
  type RateLimiterAbstract,
} from "rate-limiter-flexible";
import { db } from "@/lib/db";
import { rateLimiterFlexible } from "@/lib/db/schema/rate-limiter";

const CLEANUP_INTERVAL_MS = 5 * 60_000;
const EXPIRED_THRESHOLD_MS = 60 * 60_000;

/*
  RateLimiterDrizzle with its store methods re-implemented on static imports.

  The library loads drizzle-orm with `import(["drizzle", "orm"].join("-"))`,
  hidden from bundlers on purpose. Next's standalone output only ships what
  tracing can see, so the production image has no node_modules/drizzle-orm
  for that import to find, and every consume() threw "Cannot find package
  'drizzle-orm'". It only works locally because node walks up from
  .next/standalone into the repo's own node_modules.

  These are the library's own queries (v11.2.0), unchanged apart from the
  imports; everything else — consume(), in-memory blocking, RateLimiterRes —
  is still the base class's.
*/
class StaticDrizzleRateLimiter extends RateLimiterDrizzle {
  // `declare`: no emitted field. A plain field would be re-initialised to
  // undefined after super() returns, dropping the timer the base constructor
  // just scheduled through _clearExpiredHourAgo.
  declare private cleanupTimer?: ReturnType<typeof setTimeout>;

  async _upsert(
    key: string,
    points: number,
    msDuration: number,
    forceExpire = false,
  ) {
    const now = new Date();
    const newExpire =
      msDuration > 0 ? new Date(now.getTime() + msDuration) : null;

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(rateLimiterFlexible)
        .where(eq(rateLimiterFlexible.key, key))
        .limit(1);

      const shouldUpdateExpire =
        forceExpire ||
        !existing?.expire ||
        existing.expire <= now ||
        newExpire === null;

      const [data] = await tx
        .insert(rateLimiterFlexible)
        .values({ key, points, expire: newExpire })
        .onConflictDoUpdate({
          target: rateLimiterFlexible.key,
          set: {
            points: shouldUpdateExpire
              ? points
              : sql`${rateLimiterFlexible.points} + ${points}`,
            ...(shouldUpdateExpire && { expire: newExpire }),
          },
        })
        .returning();
      return data;
    });
  }

  async _get(rlKey: string) {
    const [row] = await db
      .select()
      .from(rateLimiterFlexible)
      .where(
        and(
          eq(rateLimiterFlexible.key, rlKey),
          or(
            gt(rateLimiterFlexible.expire, new Date()),
            isNull(rateLimiterFlexible.expire),
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async _delete(rlKey: string) {
    const [row] = await db
      .delete(rateLimiterFlexible)
      .where(eq(rateLimiterFlexible.key, rlKey))
      .returning({ key: rateLimiterFlexible.key });
    return !!row?.key;
  }

  // Also called from the base constructor, before this subclass is set up.
  _clearExpiredHourAgo() {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(async () => {
      try {
        await db
          .delete(rateLimiterFlexible)
          .where(
            lt(
              rateLimiterFlexible.expire,
              new Date(Date.now() - EXPIRED_THRESHOLD_MS),
            ),
          );
      } catch (error) {
        console.warn("Failed to clear expired rate limit records:", error);
      }
      this._clearExpiredHourAgo();
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }
}

// Counters live in Postgres so limits are shared across ECS tasks. The atomic
// limiter increments in SQL (points = points + n); the NonAtomic variant reads
// then writes an absolute value, so concurrent requests overwrite each other
// and a parallel burst gets through uncounted. inMemoryBlockOnConsumed only
// helps after the quota is hit: it skips store I/O on the retry storm.
export function drizzleRateLimiter(
  keyPrefix: string,
  points: number,
  duration = 60,
): RateLimiterAbstract {
  return new StaticDrizzleRateLimiter({
    storeClient: db,
    schema: rateLimiterFlexible,
    keyPrefix,
    points,
    duration,
    inMemoryBlockOnConsumed: points,
  });
}

async function tryConsumeRateLimit(
  limiter: RateLimiterAbstract,
  key: string,
): Promise<boolean> {
  try {
    await limiter.consume(key);
    return true;
  } catch (rej) {
    // Quota / in-memory block reject with RateLimiterRes, not Error.
    if (rej instanceof Error) {
      throw rej;
    }
    return false;
  }
}

/** `null` if allowed; otherwise `blockedMessage`. */
export async function rateLimitMessage(
  limiter: RateLimiterAbstract,
  key: string,
  blockedMessage: string,
): Promise<string | null> {
  if (await tryConsumeRateLimit(limiter, key)) {
    return null;
  }
  return blockedMessage;
}
