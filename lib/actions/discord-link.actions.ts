import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  discordAccounts,
  discordLinkAuditLog,
  type DiscordLinkAction,
  type DiscordLinkAuditDetails,
} from "@/lib/db/schema/discord";

/**
 * Linking a Discord account to a dashboard account, and the audit trail that
 * goes with it. Parameterized by userId and free of "use server" so the route
 * handler and the server action can both call in.
 */

export interface ExistingLink {
  discordUserId: string;
  discordUsername: string | null;
  verifiedAt: Date;
}

export type LinkOutcome =
  | {
      ok: true;
      action: Extract<DiscordLinkAction, "linked" | "relinked" | "replaced">;
    }
  | { ok: false; code: "already_linked_elsewhere" };

export async function currentDiscordLink(
  userId: string,
): Promise<ExistingLink | null> {
  const [row] = await db
    .select({
      discordUserId: discordAccounts.discordUserId,
      discordUsername: discordAccounts.discordUsername,
      verifiedAt: discordAccounts.verifiedAt,
    })
    .from(discordAccounts)
    .where(eq(discordAccounts.userId, userId))
    .limit(1);

  return row ?? null;
}

async function audit(
  executor: Pick<typeof db, "insert">,
  entry: {
    userId: string;
    userEmail: string;
    discordUserId: string;
    discordUsername: string | null;
    action: DiscordLinkAction;
    details?: DiscordLinkAuditDetails;
  },
) {
  await executor.insert(discordLinkAuditLog).values({
    userId: entry.userId,
    userEmail: entry.userEmail,
    discordUserId: entry.discordUserId,
    discordUsername: entry.discordUsername,
    action: entry.action,
    details: entry.details ?? {},
  });
}

/**
 * Records the link, and the fact that it happened.
 *
 * The audit insert shares the upsert's transaction: a crash between the two
 * would otherwise leave a link nothing accounts for. The row lock on the
 * caller's existing row is what lets the audit name what was replaced, and stops
 * two confirms racing to a pair of "linked" rows.
 */
export async function linkDiscordAccount(args: {
  userId: string;
  userEmail: string;
  discordUserId: string;
  discordUsername: string | null;
}): Promise<LinkOutcome> {
  const { userId, userEmail, discordUserId, discordUsername } = args;

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          discordUserId: discordAccounts.discordUserId,
          discordUsername: discordAccounts.discordUsername,
        })
        .from(discordAccounts)
        .where(eq(discordAccounts.userId, userId))
        .limit(1)
        .for("update");

      await tx
        .insert(discordAccounts)
        .values({ userId, discordUserId, discordUsername })
        .onConflictDoUpdate({
          target: discordAccounts.userId,
          set: {
            discordUserId,
            discordUsername,
            verifiedAt: new Date(),
          },
        });

      let action: Extract<
        DiscordLinkAction,
        "linked" | "relinked" | "replaced"
      > = "linked";
      let details: DiscordLinkAuditDetails = {};
      if (existing?.discordUserId === discordUserId) {
        action = "relinked";
      } else if (existing) {
        action = "replaced";
        details = {
          previousDiscordUserId: existing.discordUserId,
          previousDiscordUsername: existing.discordUsername,
        };
      }

      await audit(tx, {
        userId,
        userEmail,
        discordUserId,
        discordUsername,
        action,
        details,
      });

      return { ok: true, action } as const;
    });
  } catch (error) {
    // The Discord account is spoken for by somebody else. Logged outside the
    // transaction that just rolled back — a refused attempt is the one thing
    // here worth keeping a record of, so it must not vanish with it.
    if (isUniqueViolation(error)) {
      await audit(db, {
        userId,
        userEmail,
        discordUserId,
        discordUsername,
        action: "link_refused",
        details: { reason: "already_linked_elsewhere" },
      }).catch((auditError) => {
        console.error("could not record a refused Discord link", auditError);
      });
      return { ok: false, code: "already_linked_elsewhere" };
    }
    throw error;
  }
}

/**
 * Removes the caller's link, freeing the Discord account to be linked to a
 * different MHacks account — the way out for someone who confirmed the link
 * while signed in to the wrong one.
 *
 * Deleted and audited in one transaction for the same reason as the link. The
 * Discord role already handed over stays; the bot never takes roles back.
 */
export async function unlinkDiscordAccount(args: {
  userId: string;
  userEmail: string;
}): Promise<ExistingLink | null> {
  const { userId, userEmail } = args;

  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(discordAccounts)
      .where(eq(discordAccounts.userId, userId))
      .returning({
        discordUserId: discordAccounts.discordUserId,
        discordUsername: discordAccounts.discordUsername,
        verifiedAt: discordAccounts.verifiedAt,
      });

    if (!removed) return null;

    await audit(tx, {
      userId,
      userEmail,
      discordUserId: removed.discordUserId,
      discordUsername: removed.discordUsername,
      action: "unlinked",
    });

    return removed;
  });
}

/** Records that a Discord role was actually handed over, closing the story. */
export async function recordRoleGranted(args: {
  userId: string;
  userEmail: string;
  discordUserId: string;
  role: string;
}): Promise<void> {
  await audit(db, {
    userId: args.userId,
    userEmail: args.userEmail,
    discordUserId: args.discordUserId,
    discordUsername: null,
    action: "role_granted",
    details: { role: args.role },
  }).catch((error) => {
    // Never fail a verification over bookkeeping.
    console.error("could not record a Discord role grant", error);
  });
}
