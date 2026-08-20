import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type UserEntry } from "@/lib/db/schema/users";
import { getSlackClient } from "./client";

export async function getOrganizerForSlackUser(
  slackUserId: string,
): Promise<UserEntry | null> {
  const slack = getSlackClient();
  const result = await slack.users.info({ user: slackUserId });
  const email = result.user?.profile?.email;
  if (!email) return null;

  const [row] = await db
    .select()
    .from(users)
    .where(
      and(
        sql`lower(${users.email}) = ${email.toLowerCase()}`,
        eq(users.role, "organizer"),
      ),
    )
    .limit(1);

  return row ?? null;
}

export function isAllowedTeam(teamId: string): boolean {
  const expected = process.env.SLACK_TEAM_ID?.trim();
  return !expected || expected === teamId;
}

export function isAllowedChannel(channelId: string): boolean {
  const raw = process.env.SLACK_ALLOWED_CHANNEL_IDS;
  if (!raw?.trim()) return true;
  const allowed = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(channelId);
}
