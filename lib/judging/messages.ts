const MESSAGES: Record<string, string> = {
  missing_key: "The judging API token is missing.",
  unknown_key: "The judging API rejected its token.",
  JUDGING_NOT_STARTED: "Judging is paused.",
  JUDGING_ALREADY_STARTED:
    "Stop judging before uploading a different CSV. Uploading the same file again leaves the current rankings in place.",
  JUDGING_NEVER_STARTED: "Upload a CSV before starting judging.",
  JUDGE_DOES_NOT_OWN_PAIR:
    "That result did not match your open pair. Ask for a new pair.",
  ABSENT_NOT_IN_PAIR: "Those projects are not the pair on your screen.",
  POOL_EXHAUSTED: "Fewer than two projects are still active.",
  TOO_FEW_ENTITIES: "The CSV needs at least two projects.",
  INVALID_COLUMNS: "The CSV headers are empty, duplicated, or unreadable.",
  INCORRECT_PAIR_FORMAT: "Pick one of the two projects as the winner.",
  RATE_LIMITED:
    "Judging is busy. Wait a moment, then try the same result again.",
  WORKER_UNAVAILABLE: "Judging is temporarily unavailable. Try again shortly.",
  DATABASE_UNREADABLE:
    "The judging database cannot be read. Reset SQLite to start over.",
  UNKNOWN_ROW: "That project is not in the current dataset.",
  UNKNOWN_ARCHIVE: "That archive no longer exists.",
  REQUEST_FAILED: "The judging API returned an unexpected response.",
};

export function judgingErrorMessage(
  code: string,
  options?: { retryAfterMs?: number; names?: string[] },
): string {
  const base = MESSAGES[code] ?? "The judging API request failed.";
  const names = options?.names?.filter(Boolean) ?? [];
  const withNames =
    code === "INVALID_COLUMNS" && names.length > 0
      ? `${base} Problem headers: ${names.join(", ")}.`
      : base;
  if (code !== "RATE_LIMITED" || !options?.retryAfterMs) return withNames;
  const seconds = Math.max(1, Math.ceil(options.retryAfterMs / 1000));
  return `${withNames} Retry in about ${seconds}s.`;
}
