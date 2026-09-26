import {
  RateLimiterDrizzle,
  type RateLimiterAbstract,
} from "rate-limiter-flexible";
import { db } from "@/lib/db";
import { rateLimiterFlexible } from "@/lib/db/schema/rate-limiter";

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
  return new RateLimiterDrizzle({
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
