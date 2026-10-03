import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireOrganizer } from "@/lib/auth/guards";
import { judgingFailure, type JudgingUploadResult } from "@/lib/judging/errors";
import {
  MdreddError,
  getPool,
  uploadDataset,
  type MdreddUnresolvedRow,
} from "@/lib/judging/mdredd";
import { syncTablesToMdredd, type TableSyncResult } from "@/lib/judging/teams";

export const dynamic = "force-dynamic";

// A route handler rather than a server action: a full Devpost export, with
// every project's write-up, can pass the 1 MB server action body limit.
const MAX_CSV_BYTES = 20 * 1024 * 1024;

function reply(result: JudgingUploadResult, status = 200) {
  return NextResponse.json(result, { status });
}

/**
 * Uploads the Devpost projects export to MDredd, which resolves every
 * submission URL and starts judging, then sends MDredd the table numbers.
 */
export async function POST(request: Request) {
  try {
    await requireOrganizer();
  } catch {
    return reply(
      { ok: false, error: "Only organizers can upload projects." },
      403,
    );
  }

  let csv: File;
  try {
    const value = (await request.formData()).get("csv");
    if (!(value instanceof File)) throw new Error("missing file");
    csv = value;
  } catch {
    return reply({ ok: false, error: "Choose the Devpost projects CSV." }, 400);
  }
  if (csv.size === 0 || csv.size > MAX_CSV_BYTES) {
    return reply(
      { ok: false, error: "The CSV must be between 1 byte and 20 MB." },
      400,
    );
  }

  let projectCount: number;
  try {
    await uploadDataset(csv);
    projectCount = (await getPool()).length;
  } catch (error) {
    const failure: JudgingUploadResult = judgingFailure(
      error,
      "Could not upload the projects. Try again.",
    );
    if (
      error instanceof MdreddError &&
      error.code === "DEVPOST_UNRESOLVED" &&
      Array.isArray(error.detail.failures)
    ) {
      failure.unresolved = error.detail.failures as MdreddUnresolvedRow[];
    }
    return reply(failure);
  }

  let tables: TableSyncResult | null = null;
  try {
    tables = await syncTablesToMdredd();
  } catch (error) {
    console.error("[judging] table sync after upload failed:", error);
  }
  revalidatePath("/admin/teams/judging");
  return reply({
    ok: true,
    message: tables
      ? `Uploaded ${projectCount} projects and sent ${tables.stored} table numbers.`
      : `Uploaded ${projectCount} projects, but the table sync failed. Use Sync tables to retry.`,
    data: { projectCount, tables },
  });
}
