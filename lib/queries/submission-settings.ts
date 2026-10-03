import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { submissionSettings } from "@/lib/db/schema/teams";

export const SUBMISSION_SETTINGS_ID = "default";

/** The single Devpost submission window. A missing row is closed. */
export async function getSubmissionSettings() {
  const [row] = await db
    .select({
      opensAt: submissionSettings.opensAt,
      closesAt: submissionSettings.closesAt,
      updatedAt: submissionSettings.updatedAt,
    })
    .from(submissionSettings)
    .where(eq(submissionSettings.id, SUBMISSION_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}
