import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { judgingSettings } from "@/lib/db/schema/reservation";

export const JUDGING_SETTINGS_ID = "default";

/**
 * The single judging row: table-reservation window and project submission
 * deadline. A missing row means reservations are closed, matching an unset
 * open time. A missing deadline does not close submissions.
 */
export async function getJudgingSettings() {
  const [row] = await db
    .select({
      reservationsOpenAt: judgingSettings.reservationsOpenAt,
      reservationsCloseAt: judgingSettings.reservationsCloseAt,
      submissionDeadline: judgingSettings.submissionDeadline,
      updatedAt: judgingSettings.updatedAt,
    })
    .from(judgingSettings)
    .where(eq(judgingSettings.id, JUDGING_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}
