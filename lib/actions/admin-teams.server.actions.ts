"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema/teams";
import {
  addTeamMemberAsOrganizer,
  createTeamAsOrganizer,
  removeTeamMemberAsOrganizer,
  setTeamDevpostUrlAsOrganizer,
} from "@/lib/actions/team.actions";
import { revalidateReservationPaths } from "@/lib/reservation/revalidate";
import { MAX_TEAM_SIZE, teamRenameReasonSchema } from "@/lib/types/teams";

// The identity performing the request is resolved here, not accepted as a
// parameter — see blacklistAndDeleteApplicationAsOrganizer for the same
// rationale. Renaming itself (and clearing these fields) happens in
// renameTeam, which any team member can call — this only sets the ask.
export async function requestTeamRename(
  teamId: string,
  reason?: string,
): Promise<void> {
  const organizer = await requireOrganizer();
  // A malformed id would otherwise reach Postgres and come back as a raw
  // "invalid input syntax for type uuid" error.
  const parsedTeamId = z.uuid().safeParse(teamId);
  if (!parsedTeamId.success) {
    throw new Error("Team not found.");
  }
  const parsedReason = teamRenameReasonSchema.parse(reason);

  const result = await db
    .update(teams)
    .set({
      renameRequestedAt: new Date().toISOString(),
      renameRequestReason: parsedReason || null,
      renameRequestedByUserId: organizer.id,
    })
    .where(eq(teams.id, parsedTeamId.data))
    .returning({ id: teams.id });

  if (result.length === 0) {
    throw new Error("Team not found.");
  }

  revalidatePath("/admin/teams");
}

export type AdminTeamActionResult =
  { ok: true; message: string } | { ok: false; error: string };

function adminTeamFailure(
  error: unknown,
  fallback: string,
): Extract<AdminTeamActionResult, { ok: false }> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? fallback };
  }
  // The core functions throw plain Errors with messages meant for the
  // organizer; anything else is unexpected and stays generic.
  if (error instanceof Error && error.constructor === Error) {
    return { ok: false, error: error.message };
  }
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

const memberEmailsSchema = z
  .array(z.string())
  .max(MAX_TEAM_SIZE, `Teams can have up to ${MAX_TEAM_SIZE} hackers.`);

/** Creates a team and puts the hackers with these emails on it. */
export async function createTeamForHackers(
  name: string,
  emails: string[],
): Promise<AdminTeamActionResult> {
  const organizer = await requireOrganizer();
  try {
    const parsedEmails = memberEmailsSchema
      .parse(emails)
      .filter((email) => email.trim());
    const { team, added } = await createTeamAsOrganizer(
      organizer,
      name,
      parsedEmails,
    );
    revalidatePath("/admin/teams");
    revalidatePath("/dashboard/team");
    return {
      ok: true,
      message: `Created ${team.name} with ${added.length} ${added.length === 1 ? "hacker" : "hackers"}.`,
    };
  } catch (error) {
    return adminTeamFailure(error, "Could not create the team. Try again.");
  }
}

export async function addHackerToTeam(
  teamId: string,
  email: string,
): Promise<AdminTeamActionResult> {
  const organizer = await requireOrganizer();
  const parsedTeamId = z.uuid().safeParse(teamId);
  if (!parsedTeamId.success) {
    return { ok: false, error: "Team not found." };
  }
  try {
    const added = await addTeamMemberAsOrganizer(
      organizer,
      parsedTeamId.data,
      email,
    );
    revalidatePath("/admin/teams");
    revalidatePath("/dashboard/team");
    return { ok: true, message: `Added ${added} to the team.` };
  } catch (error) {
    return adminTeamFailure(error, "Could not add the hacker. Try again.");
  }
}

export async function removeHackerFromTeam(
  teamId: string,
  memberUserId: string,
): Promise<AdminTeamActionResult> {
  const organizer = await requireOrganizer();
  const parsedTeamId = z.uuid().safeParse(teamId);
  const parsedUserId = z.uuid().safeParse(memberUserId);
  if (!parsedTeamId.success || !parsedUserId.success) {
    return { ok: false, error: "That hacker is no longer on this team." };
  }
  try {
    const { email, teamDeleted } = await removeTeamMemberAsOrganizer(
      organizer,
      parsedTeamId.data,
      parsedUserId.data,
    );
    revalidatePath("/admin/teams");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/team");
    if (teamDeleted) revalidateReservationPaths();
    return {
      ok: true,
      message: teamDeleted
        ? `Removed ${email}. The team had no one left, so it was deleted.`
        : `Removed ${email} from the team.`,
    };
  } catch (error) {
    return adminTeamFailure(error, "Could not remove the hacker. Try again.");
  }
}

/** Sets a team's Devpost link, or clears it when `url` is empty. */
export async function setTeamDevpostUrl(
  teamId: string,
  url: string,
): Promise<AdminTeamActionResult> {
  const organizer = await requireOrganizer();
  const parsedTeamId = z.uuid().safeParse(teamId);
  if (!parsedTeamId.success) {
    return { ok: false, error: "Team not found." };
  }
  try {
    const saved = await setTeamDevpostUrlAsOrganizer(
      organizer,
      parsedTeamId.data,
      z.string().max(4096).parse(url),
    );
    revalidatePath("/admin/teams");
    revalidatePath("/admin/teams/judging");
    revalidatePath("/dashboard/team");
    return {
      ok: true,
      message: saved ? "Devpost link saved." : "Devpost link removed.",
    };
  } catch (error) {
    return adminTeamFailure(
      error,
      "Could not save the Devpost link. Try again.",
    );
  }
}
