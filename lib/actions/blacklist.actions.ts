import { eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blacklist,
  normalizedBlacklistName,
  normalizedBlacklistPhone,
  type BlacklistRow,
} from "@/lib/db/schema/blacklist";
import {
  hackerApplicants,
  hackerApplicationDrafts,
} from "@/lib/db/schema/applications";
import { hackerReimbursements } from "@/lib/db/schema/reimbursements";
import { users, type UserEntry } from "@/lib/db/schema/users";
import { deleteResumeObject } from "@/lib/resume";

/**
 * Builds the name a blacklist entry is matched against. Kept here so the web
 * form, the MCP server, and any future entry point all compose it identically.
 */
export function applicantFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

/**
 * Returns the blacklist entry blocking this applicant, or null.
 *
 * A match on EITHER identifier blocks. The comparison runs entirely in
 * Postgres, passing the incoming values through the same normalization
 * expressions that produced the stored generated columns — so casing, spacing,
 * and phone punctuation can't cause a miss. Normalization yields NULL for
 * blank input, and `NULL = x` is never true, so absent identifiers simply
 * don't participate rather than matching everything.
 */
export async function findBlacklistMatch(
  fullName: string,
  phoneNumber: string,
): Promise<BlacklistRow | null> {
  const rows = await db
    .select()
    .from(blacklist)
    .where(
      or(
        eq(
          blacklist.fullNameNormalized,
          normalizedBlacklistName(sql`${fullName}`),
        ),
        eq(
          blacklist.phoneNumberNormalized,
          normalizedBlacklistPhone(sql`${phoneNumber}`),
        ),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Blacklists an applicant and erases their application footprint.
 *
 * Parameterized by the acting organizer rather than reading the session, so the
 * authorization check lives in exactly one place — the `"use server"` wrapper in
 * application-review.server.actions.ts — mirroring how
 * submitHackerApplicationForUser is shared by the web form and MCP. Callers are
 * responsible for having already established that the actor is an organizer.
 */
export async function blacklistAndDeleteApplicationForOrganizer(
  organizer: Pick<UserEntry, "id" | "email">,
  { applicationId, reason }: { applicationId: string; reason: string },
): Promise<{ userId: string; fullName: string }> {
  const deleted = await db.transaction(async (tx) => {
    // Locked without a join: Postgres rejects FOR UPDATE against the nullable
    // side of an outer join, so the applicant's email is read separately below.
    const [row] = await tx
      .select({
        userId: hackerApplicants.userId,
        firstName: hackerApplicants.firstName,
        lastName: hackerApplicants.lastName,
        phoneNumber: hackerApplicants.phoneNumber,
        resume: hackerApplicants.resume,
      })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.id, applicationId))
      .for("update");

    if (!row) throw new Error("Application not found");

    const [owner] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    const fullName = applicantFullName(row.firstName, row.lastName);

    // No conflict target: `blacklist` has two *partial* unique indexes over
    // generated columns (normalized name, normalized phone), and an applicant
    // matching either is already listed. A bare DO NOTHING covers both, so
    // re-blacklisting someone can't block the deletion.
    await tx
      .insert(blacklist)
      .values({
        fullName,
        phoneNumber: row.phoneNumber,
        reason: `Removed application (${owner?.email ?? "unknown email"}) by ${organizer.email} — ${reason}`,
        createdByUserId: organizer.id,
      })
      .onConflictDoNothing();

    // Cascades to hacker_application_reviews and hacker_application_review_events.
    await tx
      .delete(hackerApplicants)
      .where(eq(hackerApplicants.id, applicationId));

    // Keyed on user_id rather than application_id, so neither cascades. A
    // surviving draft would re-fill the form at /apply; a surviving award would
    // keep counting toward the committed reimbursement budget.
    await tx
      .delete(hackerApplicationDrafts)
      .where(eq(hackerApplicationDrafts.userId, row.userId));
    await tx
      .delete(hackerReimbursements)
      .where(eq(hackerReimbursements.userId, row.userId));

    return { userId: row.userId, fullName, resumeKey: row.resume };
  });

  // After the commit, and best-effort: the database is the source of truth, so
  // a failed object delete should leave an orphaned PDF rather than undo the
  // removal.
  if (deleted.resumeKey) {
    try {
      await deleteResumeObject(deleted.resumeKey);
    } catch (error) {
      console.error("Unable to delete resume for removed application:", error);
    }
  }

  return { userId: deleted.userId, fullName: deleted.fullName };
}
