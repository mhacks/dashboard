export type JudgingAttributes = Record<string, string>;

export type JudgingRow = {
  id: number;
  attributes: JudgingAttributes;
};

export type PoolEntry = JudgingRow & {
  strikes: number;
  removed: boolean;
};

export type JudgingPair = {
  pair: [JudgingRow, JudgingRow];
};

export type CsvEnrichSummary = {
  projects: number;
  matched: number;
  unmatched: number;
  redirectFailures: number;
  ambiguous: number;
  submissionUrlHeader: string;
  trackHeader: string | null;
  titleHeader: string | null;
  unmatchedSamples: string[];
  renamedHeaders: string[];
};

export type ActionFailure = {
  ok: false;
  error: string;
  code?: string;
  retryAfterMs?: number;
};

export type ActionSuccess<T extends Record<string, unknown>> = {
  ok: true;
} & T;

export type AdminJudgingSnapshot = {
  configured: boolean;
  error: string | null;
  isStarted: boolean | null;
  rankings: JudgingRow[];
  pool: PoolEntry[];
  archives: string[];
  headers: string[];
};
