"use server";

import { revalidatePath } from "next/cache";
import {
  ShareBouquetError,
  shareBouquetForUser,
} from "@/lib/actions/bouquet.actions";
import { requireSessionUser } from "@/lib/auth/guards";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

const shareLimiter = drizzleRateLimiter("bouquet:share", 5);

/* Returns the error rather than throwing it: production builds replace a
   thrown server-action message with a generic digest, and the rate-limit
   message is one the hacker should actually get to read. */
export const shareBouquet = async (
  arrangement: unknown,
): Promise<{ error: string | null }> => {
  const { id: userId } = await requireSessionUser();
  const blocked = await rateLimitMessage(
    shareLimiter,
    userId,
    "That's a lot of sharing! Wait a minute and try again.",
  );
  if (blocked) return { error: blocked };

  try {
    await shareBouquetForUser(userId, arrangement);
  } catch (error) {
    if (error instanceof ShareBouquetError) return { error: error.message };
    console.error("Failed to share bouquet", error);
    return { error: "Couldn't share your bouquet. Try again in a moment." };
  }
  revalidatePath("/live");
  return { error: null };
};
