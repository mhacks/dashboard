"use server";

import { requireOrganizer } from "@/lib/auth/guards";
import { CsvSchemaError } from "@/lib/judging/csv";
import { presentRow } from "@/lib/judging/display";
import { enrichDevpostCsv } from "@/lib/judging/enrich";
import {
  archiveDatabase,
  failureFromUnknown,
  getArchives,
  getColumns,
  getJudgingStatus,
  getPool,
  getRankings,
  MdreddError,
  mdreddConfigured,
  restoreProject,
  startJudging,
  stopJudging,
  uploadDataset,
} from "@/lib/judging/mdredd";
import { listSubmissionJoins } from "@/lib/judging/submissions";
import type {
  ActionFailure,
  ActionSuccess,
  AdminJudgingSnapshot,
  CsvEnrichSummary,
} from "@/lib/judging/types";

const MAX_CSV_BYTES = 8 * 1024 * 1024;

export async function loadAdminJudgingSnapshot(): Promise<AdminJudgingSnapshot> {
  await requireOrganizer();
  if (!mdreddConfigured()) {
    return {
      configured: false,
      error: "MDREDD_API_TOKEN is not set on the dashboard.",
      isStarted: null,
      rankings: [],
      pool: [],
      archives: [],
      headers: [],
    };
  }

  try {
    const [isStarted, pool, archives, headers, rankings] = await Promise.all([
      getJudgingStatus(),
      getPool(),
      getArchives(),
      getColumns(),
      getRankings().catch((error: unknown) => {
        if (
          error instanceof MdreddError &&
          error.code === "JUDGING_NEVER_STARTED"
        ) {
          return [];
        }
        throw error;
      }),
    ]);
    return {
      configured: true,
      error: null,
      isStarted,
      rankings: rankings.map(presentRow),
      pool: pool.map(presentRow),
      archives,
      headers,
    };
  } catch (error) {
    return {
      configured: true,
      error: failureFromUnknown(error).error,
      isStarted: null,
      rankings: [],
      pool: [],
      archives: [],
      headers: [],
    };
  }
}

async function withSnapshot(
  run: () => Promise<void>,
): Promise<ActionSuccess<{ snapshot: AdminJudgingSnapshot }> | ActionFailure> {
  try {
    await requireOrganizer();
    await run();
    return { ok: true, snapshot: await loadAdminJudgingSnapshot() };
  } catch (error) {
    return failureFromUnknown(error);
  }
}

export async function uploadJudgingCsv(formData: FormData): Promise<
  | ActionSuccess<{
      summary: CsvEnrichSummary;
      snapshot: AdminJudgingSnapshot;
    }>
  | ActionFailure
> {
  try {
    await requireOrganizer();
    const file = formData.get("csv");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a CSV file." };
    }
    if (file.size > MAX_CSV_BYTES) {
      return { ok: false, error: "CSV must be 8 MB or smaller." };
    }
    const enriched = await enrichDevpostCsv(
      await file.text(),
      await listSubmissionJoins(),
    );
    await uploadDataset(enriched.csv);
    return {
      ok: true,
      summary: enriched.summary,
      snapshot: await loadAdminJudgingSnapshot(),
    };
  } catch (error) {
    if (error instanceof CsvSchemaError) {
      return { ok: false, error: error.message };
    }
    return failureFromUnknown(error);
  }
}

export async function startAdminJudging() {
  return withSnapshot(async () => {
    await startJudging();
  });
}

export async function stopAdminJudging() {
  return withSnapshot(async () => {
    await stopJudging();
  });
}

export async function resetJudgingDatabase(): Promise<
  | ActionSuccess<{
      archivePath: string | null;
      snapshot: AdminJudgingSnapshot;
    }>
  | ActionFailure
> {
  try {
    await requireOrganizer();
    const archivePath = await archiveDatabase();
    return {
      ok: true,
      archivePath,
      snapshot: await loadAdminJudgingSnapshot(),
    };
  } catch (error) {
    return failureFromUnknown(error);
  }
}

export async function restoreDroppedProject(entityId: number) {
  if (!Number.isInteger(entityId) || entityId < 0) {
    return { ok: false as const, error: "That project id is not valid." };
  }
  return withSnapshot(async () => {
    await restoreProject(entityId);
  });
}
