import {
  RateLimiterDrizzleNonAtomic,
  type RateLimiterAbstract,
} from "rate-limiter-flexible";
import { db } from "@/lib/db";
import { rateLimiterFlexible } from "@/lib/db/schema/rate-limiter";

// NonAtomic + inMemoryBlockOnConsumed: Postgres limits shared across ECS tasks;
// per-task memory block skips store I/O on retry storms after quota is hit.
export function drizzleRateLimiter(
  keyPrefix: string,
  points: number,
  duration = 60,
): RateLimiterAbstract {
  return new RateLimiterDrizzleNonAtomic({
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
