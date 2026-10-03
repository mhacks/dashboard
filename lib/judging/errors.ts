import "server-only";

import { MdreddError, type MdreddUnresolvedRow } from "@/lib/judging/mdredd";
import type { TableSyncResult } from "@/lib/judging/teams";

export type JudgingActionResult<T = never> =
  | { ok: true; message: string; data?: T }
  | {
      ok: false;
      error: string;
      code?: string;
      /** Milliseconds until MDredd's rate limit allows another try. */
      retryAfterMs?: number;
    };

export type JudgingUploadResult = JudgingActionResult<{
  projectCount: number;
  /** Null when the upload landed but the table sync after it failed. */
  tables: TableSyncResult | null;
}> & {
  /** Rows whose submission URL did not resolve, when the upload was refused for that. */
  unresolved?: MdreddUnresolvedRow[];
};

const MESSAGES: Record<string, string> = {
  NOT_CONFIGURED:
    "Judging is not set up on this server. Set MDREDD_API_URL and MDREDD_API_TOKEN.",
  UNREACHABLE: "Could not reach the judging server. Try again shortly.",
  JUDGING_NOT_STARTED: "Judging is paused right now.",
  JUDGING_NEVER_STARTED: "No projects have been uploaded for judging yet.",
  JUDGING_ALREADY_STARTED:
    "Judging is running with a different project list. Stop judging before uploading a new one.",
  POOL_EXHAUSTED: "Fewer than two projects are left to judge.",
  JUDGE_DOES_NOT_OWN_PAIR:
    "That pair is no longer yours. Load your current pair and vote again.",
  ABSENT_NOT_IN_PAIR:
    "That project is no longer in your pair. Load your current pair and try again.",
  INCORRECT_PAIR_FORMAT: "Pick one of the two projects.",
  TOO_FEW_ENTITIES:
    "The CSV needs at least two submitted projects (drafts are skipped).",
  INVALID_COLUMNS: "The CSV's columns don't match the Devpost projects export.",
  DEVPOST_UNRESOLVED:
    "Some submission links could not be followed on Devpost. Nothing was uploaded.",
  UNKNOWN_ROW: "That project no longer exists.",
  RATE_LIMITED: "The judging server is busy.",
  WORKER_UNAVAILABLE: "The judging server is restarting. Try again shortly.",
  DATABASE_UNREADABLE:
    "The judging server's database could not be read. It needs to be archived.",
  missing_key: "The judging server rejected this dashboard's token.",
  unknown_key: "The judging server rejected this dashboard's token.",
};

export function judgingFailure(
  error: unknown,
  fallback: string,
): Extract<JudgingActionResult, { ok: false }> {
  if (!(error instanceof MdreddError)) {
    console.error("[judging]", error);
    return { ok: false, error: fallback };
  }
  if (!MESSAGES[error.code]) {
    console.error(
      "[judging] unexpected MDredd error:",
      error.status,
      error.code,
    );
  }
  let message = MESSAGES[error.code] ?? fallback;
  const retryAfterMs = error.retryAfterMs ?? undefined;
  if (retryAfterMs !== undefined) {
    message = `${message} Try again in ${Math.ceil(retryAfterMs / 1000)}s.`;
  }
  if (error.code === "INVALID_COLUMNS" && Array.isArray(error.detail.names)) {
    const names = error.detail.names.filter(
      (name): name is string => typeof name === "string",
    );
    const named = names.filter((name) => name.trim());
    const blank = names.length - named.length;
    if (named.length > 0) {
      message = `${message} Missing or repeated: ${named.join(", ")}.`;
    }
    if (blank > 0) {
      message = `${message} ${blank} ${blank === 1 ? "column has" : "columns have"} no header. Upload the file as downloaded from Devpost, without re-saving it in a spreadsheet.`;
    }
  }
  return { ok: false, error: message, code: error.code, retryAfterMs };
}
