import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { discordAccounts } from "@/lib/db/schema/discord";
import { users } from "@/lib/db/schema/users";

/**
 * Whether a dashboard account is entitled to a Discord role — see
 * lookupDiscordMemberByDiscordId below for who and why. Shared with
 * isDiscordEligible so that linking and claiming agree on who qualifies.
 */
const eligibleSql = sql<boolean>`(${users.role} = 'hacker' AND public.has_confirmed_rsvp(${users.id})) OR ${users.role} IN ('organizer', 'volunteer')`;

export interface DiscordMember {
  userId: string;
  email: string;
  role: string;
  /** Null when the dashboard has no name for them — see the note below. */
  fullName: string | null;
  eligible: boolean;
}

/**
 * Who owns a Discord account, and whether they're entitled to a role.
 *
 * Eligibility mirrors the bot's roles: an RSVP'd hacker and any organizer get
 * Hacker, any volunteer gets Volunteer, everyone else is refused. It is
 * recomputed on every call rather than stored, so a hacker whose RSVP was
 * withdrawn stops being eligible without anything having to remember to revoke
 * them.
 *
 * Organizers carry no RSVP condition because they have nothing to RSVP to — they
 * run the event. admin and judge stay refused, matching requireOrganizer in
 * lib/auth/guards.ts and the isEventStaff RLS predicate: the enum values exist
 * but nothing in this app grants them anything.
 *
 * fullName deliberately has no email fallback, unlike personNameSql in
 * lib/db/person-name.ts: the bot sets this as a Discord nickname, and a nickname
 * that is someone's email address is worse than leaving theirs alone. Volunteers
 * and most organizers have no application row, so theirs is null and the bot
 * leaves their nickname alone.
 */
export async function lookupDiscordMemberByDiscordId(
  discordUserId: string,
): Promise<DiscordMember | null> {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
      fullName: sql<
        string | null
      >`nullif(trim(coalesce(${hackerApplicants.firstName}, '') || ' ' || coalesce(${hackerApplicants.lastName}, '')), '')`,
      eligible: eligibleSql,
    })
    .from(discordAccounts)
    .innerJoin(users, eq(users.id, discordAccounts.userId))
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .where(eq(discordAccounts.discordUserId, discordUserId))
    .limit(1);

  return row ?? null;
}

/**
 * Whether this account may link a Discord account at all. The claim re-checks
 * on every call, so this only turns someone away earlier, with a clearer
 * reason, rather than letting them link and then be refused a role.
 */
export async function isDiscordEligible(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ eligible: eligibleSql })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.eligible ?? false;
}
