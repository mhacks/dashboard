"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireJudge, requireOrganizer } from "@/lib/auth/guards";
import { judgingFailure, type JudgingActionResult } from "@/lib/judging/errors";
import {
  requestPair,
  restoreProject,
  setJudgingStarted,
  submitComparison,
  type MdreddProject,
} from "@/lib/judging/mdredd";
import {
  getSubmittedTeams,
  syncTablesToMdredd,
  teamsByUrl,
  type TableSyncResult,
} from "@/lib/judging/teams";
import { normalizeDevpostUrl } from "@/lib/judging/url";

const ADMIN_JUDGING_PATH = "/admin/teams/judging";

export type JudgeProject = MdreddProject & {
  teamName: string | null;
  tableId: string | null;
  tableNumber: number | null;
};

export type JudgePair = [JudgeProject, JudgeProject];

/* ——— judge ————————————————————————————————————————————————————— */

async function withTeams(
  pair: [MdreddProject, MdreddProject],
): Promise<JudgePair> {
  const byUrl = teamsByUrl(await getSubmittedTeams());
  const annotate = (project: MdreddProject): JudgeProject => {
    const team = project.url
      ? byUrl.get(normalizeDevpostUrl(project.url))
      : undefined;
    return {
      ...project,
      teamName: team?.teamName ?? null,
      tableId: team?.tableId ?? null,
      tableNumber: team?.tableNumber ?? null,
    };
  };
  return [annotate(pair[0]), annotate(pair[1])];
}

const absentSchema = z.array(z.number().int().nonnegative()).max(2);

/**
 * This judge's open pair, or a new one. With `absent`, those projects (which
 * must be in the open pair) were not at their table: they are struck and the
 * next pair is returned.
 */
export async function getJudgePair(
  absent: number[] = [],
): Promise<JudgingActionResult<JudgePair>> {
  const user = await requireJudge();
  const parsed = absentSchema.safeParse(absent);
  if (!parsed.success) return { ok: false, error: "Invalid absence report." };
  try {
    const pair = await requestPair(user.id, parsed.data);
    return { ok: true, message: "", data: await withTeams(pair) };
  } catch (error) {
    return judgingFailure(error, "Could not load your next pair. Try again.");
  }
}

const voteSchema = z
  .object({
    entityIds: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),
    winnerId: z.number().int().nonnegative(),
  })
  .refine((vote) => vote.entityIds.includes(vote.winnerId));

export async function submitJudgeVote(input: {
  entityIds: [number, number];
  winnerId: number;
}): Promise<JudgingActionResult> {
  const user = await requireJudge();
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Pick one of the two projects." };
  try {
    await submitComparison(
      user.id,
      parsed.data.entityIds,
      parsed.data.winnerId,
    );
    return { ok: true, message: "Vote recorded." };
  } catch (error) {
    return judgingFailure(error, "Could not record your vote. Try again.");
  }
}

/* ——— organizer ————————————————————————————————————————————————— */

export async function syncJudgingTables(): Promise<
  JudgingActionResult<TableSyncResult>
> {
  await requireOrganizer();
  try {
    const data = await syncTablesToMdredd();
    revalidatePath(ADMIN_JUDGING_PATH);
    return {
      ok: true,
      message: `Sent ${data.stored} table ${data.stored === 1 ? "number" : "numbers"} to the judging server.`,
      data,
    };
  } catch (error) {
    return judgingFailure(error, "Could not sync tables. Try again.");
  }
}

export async function setJudgingOpen(
  started: boolean,
): Promise<JudgingActionResult> {
  await requireOrganizer();
  try {
    await setJudgingStarted(z.boolean().parse(started));
    revalidatePath(ADMIN_JUDGING_PATH);
    return {
      ok: true,
      message: started ? "Judging started." : "Judging stopped.",
    };
  } catch (error) {
    return judgingFailure(
      error,
      started ? "Could not start judging." : "Could not stop judging.",
    );
  }
}

export async function restoreJudgingProject(
  id: number,
): Promise<JudgingActionResult> {
  await requireOrganizer();
  try {
    const entry = await restoreProject(
      z.number().int().nonnegative().parse(id),
    );
    revalidatePath(ADMIN_JUDGING_PATH);
    const name = entry.attributes["Project Title"] ?? `Project ${entry.id}`;
    return { ok: true, message: `${name} is back in the judging pool.` };
  } catch (error) {
    return judgingFailure(error, "Could not restore the project. Try again.");
  }
}
