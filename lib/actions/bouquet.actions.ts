import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { liveBouquets } from "@/lib/db/schema/bouquets";
import { users } from "@/lib/db/schema/users";
import { formatMakerName, sharedArrangementSchema } from "@/lib/bouquet/share";
import { decisionOutcome } from "@/lib/decisions";

// Shown when the sharer has no application to take a name from — in practice
// an organizer trying the game out.
const FALLBACK_MAKER_NAME = "An MHacks hacker";

/** A refusal whose message is safe, and meant, to show the hacker. */
export class ShareBouquetError extends Error {}

/**
 * Puts `userId`'s bouquet on the /live hero, replacing any they shared before.
 *
 * Only accepted hackers (and organizers, to try it out) may share: anyone with
 * an email can sign in and fill in an application, and the "Made by" name on
 * a public page comes from it. The name is read here, never from the client,
 * so the tag can't be used to put words in someone else's mouth.
 */
export async function shareBouquetForUser(
  userId: string,
  input: unknown,
): Promise<void> {
  const parsed = sharedArrangementSchema.safeParse(input);
  if (!parsed.success) {
    throw new ShareBouquetError("That bouquet couldn't be shared.");
  }

  const [sharer] = await db
    .select({
      role: users.role,
      decision: hackerApplicants.decision,
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
    })
    .from(users)
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  const accepted =
    sharer?.role === "hacker" &&
    !!sharer.decision &&
    decisionOutcome(sharer.decision) === "accepted";
  if (!sharer || (!accepted && sharer.role !== "organizer")) {
    throw new ShareBouquetError(
      "Sharing to the live site is open to accepted hackers.",
    );
  }

  const makerName =
    formatMakerName(sharer.firstName ?? "", sharer.lastName ?? "") ||
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
