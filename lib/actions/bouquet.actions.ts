import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { liveBouquets } from "@/lib/db/schema/bouquets";
import { formatMakerName, sharedArrangementSchema } from "@/lib/bouquet/share";

// Shown when the sharer has no application to take a name from — in practice
// an organizer trying the game out.
const FALLBACK_MAKER_NAME = "An MHacks hacker";

/**
 * Puts `userId`'s bouquet on the /live hero, replacing any they shared before.
 * The maker name comes from their application, never from the client, so the
 * "Made by" tag can't be used to put words in someone else's mouth.
 */
export async function shareBouquetForUser(
  userId: string,
  input: unknown,
): Promise<void> {
  const parsed = sharedArrangementSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("That bouquet couldn't be shared.");
  }

  const [applicant] = await db
    .select({
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
    })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);
  const makerName =
    (applicant && formatMakerName(applicant.firstName, applicant.lastName)) ||
    FALLBACK_MAKER_NAME;

  // `hidden` is deliberately left out of the update set: re-sharing must not
  // undo an organizer hiding the previous one.
  await db
    .insert(liveBouquets)
    .values({ userId, arrangement: parsed.data, makerName })
    .onConflictDoUpdate({
      target: liveBouquets.userId,
      set: {
        arrangement: parsed.data,
        makerName,
        updatedAt: sql`now()`,
      },
    });
}
