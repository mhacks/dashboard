/**
 * Devpost export headers change between hackathons. Detection is alias-based
 * so a later CSV can rename columns without a code change, as long as one
 * header still reads as a submission URL (and, when present, a track).
 *
 * The enriched columns below are stable names the dashboard writes before
 * upload. The judging UI reads those first, then falls back to detection.
 */

export const JOIN_COLUMNS = {
  resolvedSubmissionUrl: "resolved_submission_url",
  teamId: "dashboard_team_id",
  teamName: "dashboard_team_name",
  tableNumber: "dashboard_table_number",
  track: "dashboard_track",
  title: "dashboard_title",
} as const;

export type JoinColumn = (typeof JOIN_COLUMNS)[keyof typeof JOIN_COLUMNS];

const URL_EXACT = [
  "submission url",
  "submission link",
  "devpost url",
  "devpost link",
  "project url",
  "project link",
  "url",
];

const TITLE_EXACT = ["project title", "title", "project name", "name"];

const TRACK_EXACT = ["track", "tracks", "main track", "prize track"];

const TABLE_EXACT = ["table number", "table", "table no", "table #"];

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/u, "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/gu, " ")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function pickHeader(
  headers: readonly string[],
  exact: readonly string[],
  fallback: (normalized: string) => boolean,
  rank: (normalized: string) => number = () => 0,
): string | null {
  const normalized = headers.map((header) => ({
    raw: header,
    key: normalizeHeader(header),
  }));
  for (const name of exact) {
    const found = normalized.find((header) => header.key === name);
    if (found) return found.raw;
  }
  const candidates = normalized.filter((header) => fallback(header.key));
  candidates.sort(
    (left, right) =>
      rank(left.key) - rank(right.key) ||
      left.key.length - right.key.length ||
      left.raw.localeCompare(right.raw),
  );
  return candidates[0]?.raw ?? null;
}

export function detectSubmissionUrlHeader(
  headers: readonly string[],
): string | null {
  return pickHeader(
    headers,
    URL_EXACT,
    (key) =>
      (key.includes("submission") &&
        (key.includes("url") || key.includes("link"))) ||
      (key.includes("devpost") &&
        (key.includes("url") || key.includes("link"))),
  );
}

export function detectTitleHeader(headers: readonly string[]): string | null {
  return pickHeader(
    headers,
    TITLE_EXACT,
    (key) => key.includes("title") && !key.includes("status"),
  );
}

export function detectTrackHeader(headers: readonly string[]): string | null {
  return pickHeader(
    headers,
    TRACK_EXACT,
    (key) => key.includes("track") && !key.includes("status"),
    (key) => (key.includes("main") ? 0 : 1),
  );
}

export function detectTableHeader(headers: readonly string[]): string | null {
  return pickHeader(headers, TABLE_EXACT, (key) => key.startsWith("table "));
}

export function isEmailHeader(header: string): boolean {
  return normalizeHeader(header).includes("email");
}
