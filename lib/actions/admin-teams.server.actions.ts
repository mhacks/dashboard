"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema/teams";
import { teamRenameReasonSchema } from "@/lib/types/teams";

// The identity performing the request is resolved here, not accepted as a
// parameter — see blacklistAndDeleteApplicationAsOrganizer for the same
// rationale. Renaming itself (and clearing these fields) happens in
// renameTeam, which any team member can call — this only sets the ask.
export async function requestTeamRename(
  teamId: string,
  reason?: string,
): Promise<void> {
  const organizer = await requireOrganizer();
  const parsedReason = teamRenameReasonSchema.parse(reason);

  const result = await db
    .update(teams)
    .set({
      renameRequestedAt: new Date().toISOString(),
      renameRequestReason: parsedReason || null,
      renameRequestedByUserId: organizer.id,
    })
    .where(eq(teams.id, teamId))
    .returning({ id: teams.id });

  if (result.length === 0) {
    throw new Error("Team not found.");
  }

  revalidatePath("/admin/teams");
}
