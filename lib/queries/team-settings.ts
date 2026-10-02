import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { teamSettings } from "@/lib/db/schema/teams";

export const TEAM_SETTINGS_ID = "default";

/**
 * Whether accepted hackers can open /dashboard/team and change teams.
 *
 * A missing row is treated as off, matching the column default, so team
 * formation stays closed until an organizer turns it on.
 */
export async function isTeamFormationEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ formationEnabled: teamSettings.formationEnabled })
    .from(teamSettings)
    .where(eq(teamSettings.id, TEAM_SETTINGS_ID))
    .limit(1);

  return row?.formationEnabled ?? false;
}
