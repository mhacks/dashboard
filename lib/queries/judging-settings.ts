import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { judgingSettings } from "@/lib/db/schema/reservation";

export const JUDGING_SETTINGS_ID = "default";

/**
 * The single table-reservation window. A missing row means reservations are
 * closed, matching an unset open time.
 */
export async function getJudgingSettings() {
  const [row] = await db
    .select({
      reservationsOpenAt: judgingSettings.reservationsOpenAt,
      reservationsCloseAt: judgingSettings.reservationsCloseAt,
      mapColumns: judgingSettings.mapColumns,
      mapRows: judgingSettings.mapRows,
      updatedAt: judgingSettings.updatedAt,
    })
    .from(judgingSettings)
    .where(eq(judgingSettings.id, JUDGING_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}
