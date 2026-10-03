import "server-only";

import { z } from "zod";
import { judgingErrorMessage } from "./messages";
import type {
  ActionFailure,
  JudgingPair,
  JudgingRow,
  PoolEntry,
} from "./types";

const rowSchema = z.object({
  id: z.number().int(),
  attributes: z.record(z.string(), z.string()),
});

const poolSchema = rowSchema.extend({
  strikes: z.number().int(),
  removed: z.boolean(),
});

const pairSchema = z.object({
  pair: z.tuple([rowSchema, rowSchema]),
});

const judgingSchema = z.object({ is_started: z.boolean() });
const datasetSchema = judgingSchema.extend({
  headers: z.array(z.string()),
});
const archiveSchema = z.object({ path: z.string().nullable() });
const archiveListSchema = z.object({ archives: z.array(z.string()) });
const columnsSchema = z.object({ headers: z.array(z.string()) });
const comparisonSchema = z.object({ ok: z.boolean() });

export class MdreddError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "MdreddError";
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export function failureFromUnknown(error: unknown): ActionFailure {
  if (error instanceof MdreddError) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      retryAfterMs: error.retryAfterMs,
    };
  }
  if (error instanceof Error && error.message) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "The judging request failed." };
}

function baseUrl(): string {
  const configured = process.env.MDREDD_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/u, "");
  if (process.env.NODE_ENV === "development") return "http://127.0.0.1:8000";
  return "https://mdredd.mhacks.org";
}

function token(): string {
  const value = process.env.MDREDD_API_TOKEN?.trim();
  if (!value) {
    throw new MdreddError(
      "MDREDD_API_TOKEN is not set on the dashboard.",
      500,
      "missing_key",
    );
  }
  return value;
}

export function mdreddConfigured(): boolean {
  return Boolean(process.env.MDREDD_API_TOKEN?.trim());
}

async function readFailure(response: Response): Promise<MdreddError> {
  let code = "REQUEST_FAILED";
  let retryAfterMs: number | undefined;
  let names: string[] | undefined;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = body.detail;
      if (typeof detail === "string") code = detail;
      else if (detail && typeof detail === "object") {
        if ("code" in detail && typeof detail.code === "string") {
          code = detail.code;
        }
        if (
          "retry_after_ms" in detail &&
          typeof detail.retry_after_ms === "number"
        ) {
          retryAfterMs = detail.retry_after_ms;
        }
        if ("names" in detail && Array.isArray(detail.names)) {
          names = detail.names.filter(
            (name): name is string => typeof name === "string",
          );
        }
      }
    }
  } catch {
    code = "REQUEST_FAILED";
  }
  return new MdreddError(
    judgingErrorMessage(code, { retryAfterMs, names }),
    response.status,
    code,
    retryAfterMs,
  );
}

async function request(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token()}`);
  const { timeoutMs = 20_000, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...rest,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new MdreddError(
      "The judging API did not respond.",
      503,
      "WORKER_UNAVAILABLE",
    );
  }
  if (!response.ok) throw await readFailure(response);
  return response;
}

async function jsonBody<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const response = await request(path, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new MdreddError(
      "The judging API returned an unreadable response.",
      502,
      "REQUEST_FAILED",
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new MdreddError(
      "The judging API returned an unexpected response.",
      502,
      "REQUEST_FAILED",
    );
  }
  return parsed.data;
}

export async function getJudgingStatus(): Promise<boolean> {
  const body = await jsonBody("/judging", judgingSchema);
  return body.is_started;
}

export async function getProjects(): Promise<JudgingRow[]> {
  return jsonBody("/projects", z.array(rowSchema));
}

export async function getRankings(): Promise<JudgingRow[]> {
  return jsonBody("/rankings", z.array(rowSchema));
}

export async function getPool(): Promise<PoolEntry[]> {
  return jsonBody("/pool", z.array(poolSchema));
}

export async function getColumns(): Promise<string[]> {
  const body = await jsonBody("/columns", columnsSchema);
  return body.headers;
}

export async function getArchives(): Promise<string[]> {
  const body = await jsonBody("/archives", archiveListSchema);
  return body.archives;
}

export async function requestPair(
  judgeId: string,
  absent: number[],
): Promise<JudgingPair> {
  const body = await jsonBody("/pairs", pairSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ judge_id: judgeId, absent }),
  });
  return body;
}

export async function submitComparison(
  judgeId: string,
  entityIds: [number, number],
  winnerId: number,
): Promise<void> {
  await jsonBody("/comparisons", comparisonSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      judge_id: judgeId,
      entity_ids: entityIds,
      winner_id: winnerId,
    }),
  });
}

export async function uploadDataset(
  csv: string,
): Promise<{ isStarted: boolean; headers: string[] }> {
  const form = new FormData();
  form.set(
    "entities_csv",
    new Blob([csv], { type: "text/csv" }),
    "entities.csv",
  );
  const body = await jsonBody("/datasets", datasetSchema, {
    method: "POST",
    body: form,
    timeoutMs: 60_000,
  });
  return { isStarted: body.is_started, headers: body.headers };
}

export async function startJudging(): Promise<boolean> {
  const body = await jsonBody("/judging/start", judgingSchema, {
    method: "POST",
  });
  return body.is_started;
}

export async function stopJudging(): Promise<boolean> {
  const body = await jsonBody("/judging/stop", judgingSchema, {
    method: "POST",
  });
  return body.is_started;
}

export async function archiveDatabase(): Promise<string | null> {
  const body = await jsonBody("/archive", archiveSchema, {
    method: "POST",
    timeoutMs: 60_000,
  });
  return body.path;
}

export async function restoreProject(entityId: number): Promise<PoolEntry> {
  return jsonBody(`/pool/${entityId}/restore`, poolSchema, { method: "POST" });
}

export async function downloadArchive(archiveId: string): Promise<Response> {
  return request(`/archives/${encodeURIComponent(archiveId)}`, {
    timeoutMs: 60_000,
  });
}
