import { DECOY_LOCKOUT_MINUTES } from "@/lib/hunt/codes";
import { drizzleRateLimiter } from "@/lib/rate-limit/drizzle";

/*
  Temporary (see huntDecoyOrganizers): a hacker who redeems a decoy
  organizer's code loses the organizer map on /find-my-organizer for
  DECOY_LOCKOUT_MINUTES. Kept in the rate limiter's table, under
  `hunt:decoy:<user id>`, so it needs no migration and expires on its own.
*/
const lockout = drizzleRateLimiter("hunt:decoy", 1, DECOY_LOCKOUT_MINUTES * 60);

export async function lockHuntMap(userId: string) {
  await lockout.block(userId, DECOY_LOCKOUT_MINUTES * 60);
}

/** Milliseconds until this user gets the map back, or 0 if it isn't hidden. */
export async function huntMapLockedMs(userId: string) {
  const res = await lockout.get(userId);
  if (!res || res.consumedPoints <= 1) return 0;
  return Math.max(0, res.msBeforeNext);
}
