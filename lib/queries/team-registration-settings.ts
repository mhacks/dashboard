import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { teamRegistrationSettings } from "@/lib/db/schema/teams";

export const TEAM_REGISTRATION_SETTINGS_ID = "default";

/** The single team-registration window. A missing row is closed. */
export async function getTeamRegistrationSettings() {
  const [row] = await db
    .select({
      opensAt: teamRegistrationSettings.opensAt,
      closesAt: teamRegistrationSettings.closesAt,
      updatedAt: teamRegistrationSettings.updatedAt,
    })
    .from(teamRegistrationSettings)
    .where(eq(teamRegistrationSettings.id, TEAM_REGISTRATION_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}
