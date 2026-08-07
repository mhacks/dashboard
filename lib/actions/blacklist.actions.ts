import { eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blacklist,
  normalizedBlacklistName,
  normalizedBlacklistPhone,
  type BlacklistRow,
} from "@/lib/db/schema/blacklist";

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
