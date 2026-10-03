import {
  detectSubmissionUrlHeader,
  detectTitleHeader,
  detectTrackHeader,
  JOIN_COLUMNS,
} from "./columns";
import { csvTable, CsvSchemaError, serializeCsv } from "./csv";
import type { CsvEnrichSummary } from "./types";
import {
  isUnresolvedSubmissionUrl,
  normalizeDevpostUrl,
  resolveDevpostRedirect,
} from "./urls";

export type SubmissionJoin = {
  devpostUrl: string;
  teamId: string;
  teamName: string;
  tableNumber: number | null;
};

function indexJoins(joins: readonly SubmissionJoin[]): {
  byUrl: Map<string, SubmissionJoin>;
  ambiguous: Set<string>;
} {
  const byUrl = new Map<string, SubmissionJoin>();
  const ambiguous = new Set<string>();
  for (const join of joins) {
    const key = normalizeDevpostUrl(join.devpostUrl);
    if (!key) continue;
    const existing = byUrl.get(key);
    if (existing && existing.teamId !== join.teamId) {
      ambiguous.add(key);
      continue;
    }
    byUrl.set(key, join);
  }
  return { byUrl, ambiguous };
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await fn(item, index);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

type Lookup = { url: string; failed: boolean };

/**
 * Resolve each submission URL, join it to a dashboard team on the public
 * Devpost URL, and append stable columns. Original columns are preserved so a
 * later export with extra fields still reaches MDredd.
 */
export async function enrichDevpostCsv(
  csvText: string,
  joins: readonly SubmissionJoin[],
  resolveRedirect: (url: string) => Promise<string> = resolveDevpostRedirect,
): Promise<{ csv: string; summary: CsvEnrichSummary }> {
  const table = csvTable(csvText);
  const submissionHeader = detectSubmissionUrlHeader(table.headers);
  if (!submissionHeader) {
    throw new CsvSchemaError(
      `No submission URL column found. Headers: ${table.headers.join(", ")}.`,
      table.headers,
    );
  }
  const trackHeader = detectTrackHeader(table.headers);
  const titleHeader = detectTitleHeader(table.headers);
  const { byUrl, ambiguous } = indexJoins(joins);

  const uniqueUrls = [
    ...new Set(
      table.records
        .map((record) => record[submissionHeader]?.trim() ?? "")
        .filter((url) => url.length > 0),
    ),
  ];
  const lookups = new Map<string, Lookup>();
  const resolved = await mapPool(uniqueUrls, 6, async (url) => {
    try {
      const next = await resolveRedirect(url);
      const failed = isUnresolvedSubmissionUrl(next);
      return { url, lookup: { url: next, failed } satisfies Lookup };
    } catch {
      return { url, lookup: { url, failed: true } satisfies Lookup };
    }
  });
  for (const entry of resolved) {
    if (!entry) continue;
    lookups.set(entry.url, entry.lookup);
  }

  let matched = 0;
  let unmatched = 0;
  let redirectFailures = 0;
  const unmatchedSamples: string[] = [];
  const usedAmbiguous = new Set<string>();

  const headers = [...table.headers];
  const columnKey = {} as Record<
    (typeof JOIN_COLUMNS)[keyof typeof JOIN_COLUMNS],
    string
  >;
  for (const name of Object.values(JOIN_COLUMNS)) {
    const existing = headers.find(
      (header) => header.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      columnKey[name] = existing;
    } else {
      headers.push(name);
      columnKey[name] = name;
    }
  }

  const records = table.records.map((record) => {
    const next = { ...record };
    const raw = record[submissionHeader]?.trim() ?? "";
    const lookup = raw ? lookups.get(raw) : undefined;
    const resolvedUrl = lookup?.url ?? raw;
    if (raw && lookup?.failed) redirectFailures += 1;

    const keys = [
      normalizeDevpostUrl(resolvedUrl),
      normalizeDevpostUrl(raw),
    ].filter((key): key is string => Boolean(key));
    let join: SubmissionJoin | undefined;
    for (const key of keys) {
      const found = byUrl.get(key);
      if (found) {
        join = found;
        if (ambiguous.has(key)) usedAmbiguous.add(key);
        break;
      }
    }

    if (join) matched += 1;
    else {
      unmatched += 1;
      if (raw && unmatchedSamples.length < 8) unmatchedSamples.push(raw);
    }

    next[columnKey[JOIN_COLUMNS.resolvedSubmissionUrl]] = resolvedUrl;
    next[columnKey[JOIN_COLUMNS.teamId]] = join?.teamId ?? "";
    next[columnKey[JOIN_COLUMNS.teamName]] = join?.teamName ?? "";
    next[columnKey[JOIN_COLUMNS.tableNumber]] =
      join?.tableNumber == null ? "" : String(join.tableNumber);
    next[columnKey[JOIN_COLUMNS.track]] = trackHeader
      ? (record[trackHeader]?.trim() ?? "")
      : (next[columnKey[JOIN_COLUMNS.track]] ?? "");
    next[columnKey[JOIN_COLUMNS.title]] = titleHeader
      ? (record[titleHeader]?.trim() ?? "")
      : (next[columnKey[JOIN_COLUMNS.title]] ?? "");
    return next;
  });

  return {
    csv: serializeCsv(headers, records),
    summary: {
      projects: records.length,
      matched,
      unmatched,
      redirectFailures,
      ambiguous: usedAmbiguous.size,
      submissionUrlHeader: submissionHeader,
      trackHeader,
      titleHeader,
      unmatchedSamples,
      renamedHeaders: table.renamedHeaders,
    },
  };
}
