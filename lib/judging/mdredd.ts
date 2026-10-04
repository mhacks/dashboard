import "server-only";

/**
 * Client for MDredd, the pairwise judging API. Every call runs on the server:
 * the token is one shared secret for the whole API, so it must never reach a
 * browser. Judges and organizers reach MDredd only through the actions in
 * lib/actions/judging.server.actions.ts.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
// Upload resolves every Devpost submission URL before answering.
const UPLOAD_TIMEOUT_MS = 300_000;

export type MdreddProject = {
  id: number;
  url: string;
  name: string;
  tracks: string[];
};

export type MdreddRow = {
  id: number;
  attributes: Record<string, string>;
};

export type MdreddPoolEntry = MdreddRow & {
  strikes: number;
  removed: boolean;
};

export type MdreddUnresolvedRow = {
  title: string;
  submission_url: string;
  code: string;
};

export class MdreddError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(`MDredd ${status} ${code}`);
    this.name = "MdreddError";
  }

  get retryAfterMs(): number | null {
    const value = this.detail.retry_after_ms;
    return typeof value === "number" ? value : null;
  }
}

function config() {
  const url = process.env.MDREDD_API_URL?.replace(/\/+$/, "");
  const token = process.env.MDREDD_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function isMdreddConfigured() {
  return config() !== null;
}

async function request(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const settings = config();
  if (!settings) throw new MdreddError(0, "NOT_CONFIGURED");
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${settings.url}${path}`, {
      ...rest,
      headers: { Authorization: `Bearer ${settings.token}`, ...headers },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.error("[MDredd] request failed:", path, error);
    throw new MdreddError(0, "UNREACHABLE");
  }
  if (response.ok) return response;

  let detail: Record<string, unknown> = {};
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (body.detail && typeof body.detail === "object") {
      detail = body.detail as Record<string, unknown>;
    }
  } catch {
    // Not JSON, e.g. a proxy error page. The status is all there is.
  }
  const code =
    typeof detail.code === "string" ? detail.code : `HTTP_${response.status}`;
  throw new MdreddError(response.status, code, detail);
}

async function requestJson<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const response = await request(path, init);
  return (await response.json()) as T;
}

function postJson<T>(path: string, body: unknown, method = "POST") {
  return requestJson<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ——— organizer ————————————————————————————————————————————————— */

export function uploadDataset(csv: Blob) {
  const form = new FormData();
  form.append("entities_csv", csv, "projects.csv");
  return requestJson<{ is_started: boolean; headers: string[] }>("/datasets", {
    method: "POST",
    body: form,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

export async function getJudgingStarted() {
  const body = await requestJson<{ is_started: boolean }>("/judging");
  return body.is_started;
}

export async function setJudgingStarted(started: boolean) {
  const path = started ? "/judging/start" : "/judging/stop";
  const body = await requestJson<{ is_started: boolean }>(path, {
    method: "POST",
  });
  return body.is_started;
}

/** Replaces MDredd's whole project URL → table number mapping. */
export function putTables(tables: Record<string, number>) {
  return postJson<{ stored: number; unknown_urls: string[] }>(
    "/tables",
    { tables },
    "PUT",
  );
}

export function getPool() {
  return requestJson<MdreddPoolEntry[]>("/pool");
}

export function restoreProject(id: number) {
  return requestJson<MdreddPoolEntry>(`/pool/${id}/restore`, {
    method: "POST",
  });
}

/** Rows strongest first, or an empty list before any dataset is uploaded. */
export async function getRankings() {
  try {
    return await requestJson<MdreddRow[]>("/rankings");
  } catch (error) {
    if (
      error instanceof MdreddError &&
      error.code === "JUDGING_NEVER_STARTED"
    ) {
      return [];
    }
    throw error;
  }
}

export async function getExportCsv() {
  const response = await request("/export");
  return response.text();
}

/* ——— judge ————————————————————————————————————————————————————— */

export type MdreddPair = {
  pair: [MdreddProject, MdreddProject];
  /** Unix seconds the pair was handed out. */
  assigned_at: number;
  /** MDredd's clock when it answered, in Unix seconds. */
  server_time: number;
};

/**
 * The judge's open pair, or a new one. With `absent`, strikes those projects
 * from the current pair and returns the next pair. With `skip` (the open
 * pair's ids), gives that pair up unjudged and returns the next one.
 */
export function requestPair(
  judgeId: string,
  options: { absent?: number[]; skip?: [number, number] } = {},
) {
  return postJson<MdreddPair>("/pairs", {
    judge_id: judgeId,
    absent: options.absent ?? [],
    ...(options.skip ? { skip: options.skip } : {}),
  });
}

export async function submitComparison(
  judgeId: string,
  entityIds: [number, number],
  winnerId: number,
) {
  await postJson<{ ok: boolean }>("/comparisons", {
    judge_id: judgeId,
    entity_ids: entityIds,
    winner_id: winnerId,
  });
}
