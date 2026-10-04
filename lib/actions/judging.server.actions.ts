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
  syncTablesIfStale,
  syncTablesToMdredd,
  teamsByUrl,
  type JudgingTeam,
  type TableSyncResult,
} from "@/lib/judging/teams";
import { normalizeDevpostUrl } from "@/lib/judging/url";
import {
  DEFAULT_PAIR_SECONDS,
  MAX_PAIR_SECONDS,
  MIN_PAIR_SECONDS,
} from "@/lib/judging/timer";
import { db } from "@/lib/db";
import { judgingSettings } from "@/lib/db/schema/reservation";
import {
  getJudgingSettings,
  JUDGING_SETTINGS_ID,
} from "@/lib/queries/judging-settings";
import { writeReservationAudit } from "@/lib/reservation/audit";

const ADMIN_JUDGING_PATH = "/admin/teams/judging";

export type JudgeProject = MdreddProject & {
  teamName: string | null;
  tableId: string | null;
  tableNumber: number | null;
};

export type JudgePair = [JudgeProject, JudgeProject];

export type JudgeAssignment = {
  pair: JudgePair;
  /** Time left on this pair when the server answered. */
  remainingMs: number;
  /** The whole time allowed per pair. */
  durationMs: number;
};

/* ——— judge ————————————————————————————————————————————————————— */

function withTeams(
  pair: [MdreddProject, MdreddProject],
  submittedTeams: JudgingTeam[],
): JudgePair {
  const byUrl = teamsByUrl(submittedTeams);
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
const pairIdsSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

/**
 * Asks MDredd for the judge's pair and works out its time left. MDredd's own
 * clock times the pair, so a refresh or another device can't reset it.
 */
async function loadAssignment(
  judgeId: string,
  options: { absent?: number[]; skip?: [number, number] },
): Promise<JudgeAssignment> {
  // MDredd only draws projects with a table, so give it current tables
  // before it draws.
  const [submittedTeams, settings] = await Promise.all([
    getSubmittedTeams(),
    getJudgingSettings(),
  ]);
  await syncTablesIfStale(submittedTeams);
  const result = await requestPair(judgeId, options);
  const durationMs = (settings?.pairSeconds ?? DEFAULT_PAIR_SECONDS) * 1000;
  const elapsedMs = (result.server_time - result.assigned_at) * 1000;
  return {
    pair: withTeams(result.pair, submittedTeams),
    remainingMs: Math.max(0, Math.round(durationMs - elapsedMs)),
    durationMs,
  };
}

/**
 * This judge's open pair, or a new one. With `absent`, those projects (which
 * must be in the open pair) were not at their table: they are struck and the
 * next pair is returned.
 */
export async function getJudgePair(
  absent: number[] = [],
): Promise<JudgingActionResult<JudgeAssignment>> {
  const user = await requireJudge();
  const parsed = absentSchema.safeParse(absent);
  if (!parsed.success) return { ok: false, error: "Invalid absence report." };
  try {
    const data = await loadAssignment(user.id, { absent: parsed.data });
    return { ok: true, message: "", data };
  } catch (error) {
    return judgingFailure(error, "Could not load your next pair. Try again.");
  }
}

/**
 * Gives up the judge's open pair unjudged, when its time runs out, and
 * returns the next one. Nothing is recorded for either project.
 */
export async function skipJudgePair(
  entityIds: [number, number],
): Promise<JudgingActionResult<JudgeAssignment>> {
  const user = await requireJudge();
  const parsed = pairIdsSchema.safeParse(entityIds);
  if (!parsed.success) return { ok: false, error: "Invalid pair." };
  try {
    const data = await loadAssignment(user.id, { skip: parsed.data });
    return { ok: true, message: "", data };
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

const pairMinutesSchema = z
  .number()
  .int("Use whole minutes.")
  .min(MIN_PAIR_SECONDS / 60, `At least ${MIN_PAIR_SECONDS / 60} minute.`)
  .max(MAX_PAIR_SECONDS / 60, `At most ${MAX_PAIR_SECONDS / 60} minutes.`);

/**
 * Sets how long judges get per pair. A pair already handed out keeps its
 * start time, so the new length applies to it from that start.
 */
export async function setJudgingPairMinutes(
  minutes: number,
): Promise<JudgingActionResult> {
  const organizer = await requireOrganizer();
  const parsed = pairMinutesSchema.safeParse(minutes);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid time.",
    };
  }
  const pairSeconds = parsed.data * 60;
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(judgingSettings)
        .values({
          id: JUDGING_SETTINGS_ID,
          pairSeconds,
          updatedByUserId: organizer.id,
        })
        .onConflictDoUpdate({
          target: judgingSettings.id,
          set: {
            pairSeconds,
            updatedByUserId: organizer.id,
            updatedAt: new Date().toISOString(),
          },
        });
      await writeReservationAudit(tx, {
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "judging.pair_time_updated",
        entityType: "judging_settings",
        entityId: null,
        details: { pairSeconds },
      });
    });
  } catch (error) {
    console.error("[judging] pair time update failed:", error);
    return { ok: false, error: "Could not save the time per pair. Try again." };
  }
  revalidatePath(ADMIN_JUDGING_PATH);
  return {
    ok: true,
    message: `Judges now get ${parsed.data} ${parsed.data === 1 ? "minute" : "minutes"} per pair.`,
  };
}
