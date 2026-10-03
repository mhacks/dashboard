import {
  detectSubmissionUrlHeader,
  detectTableHeader,
  detectTitleHeader,
  detectTrackHeader,
  isEmailHeader,
  JOIN_COLUMNS,
  normalizeHeader,
} from "./columns";
import type { JudgingRow } from "./types";

export type AttributeField = {
  label: string;
  value: string;
};

export type ProjectView = {
  id: number;
  title: string;
  track: string;
  tableLabel: string;
  tableNumeric: number | null;
  teamName: string;
  url: string;
  highlights: AttributeField[];
  details: AttributeField[];
};

const HIGHLIGHTS: { label: string; test: (header: string) => boolean }[] = [
  {
    label: "Built with",
    test: (header) => {
      const key = normalizeHeader(header);
      return key === "built with" || key === "technologies";
    },
  },
  {
    label: "Try it out",
    test: (header) => normalizeHeader(header).includes("try it out"),
  },
  {
    label: "Video",
    test: (header) => normalizeHeader(header).includes("video"),
  },
];

function isPrivateValue(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}

export function tableNumberValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/u.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

function cell(
  attributes: JudgingRow["attributes"],
  header: string | null,
): string {
  if (!header) return "";
  const direct = attributes[header];
  if (direct != null) return direct.trim();
  const found = Object.keys(attributes).find(
    (key) => key.toLowerCase() === header.toLowerCase(),
  );
  return found ? (attributes[found]?.trim() ?? "") : "";
}

export function readTrack(attributes: JudgingRow["attributes"]): string {
  const stable = cell(attributes, JOIN_COLUMNS.track);
  if (stable) return stable;
  return cell(attributes, detectTrackHeader(Object.keys(attributes)));
}

export function readProjectView(row: JudgingRow): ProjectView {
  const attributes = row.attributes;
  const headers = Object.keys(attributes);
  const titleHeader = detectTitleHeader(headers);
  const trackHeader = detectTrackHeader(headers);
  const tableHeader = detectTableHeader(headers);
  const urlHeader = detectSubmissionUrlHeader(headers);
  const title =
    cell(attributes, JOIN_COLUMNS.title) ||
    cell(attributes, titleHeader) ||
    `Project ${row.id + 1}`;
  const track = readTrack(attributes);
  const dashboardTable = cell(attributes, JOIN_COLUMNS.tableNumber);
  const csvTable = cell(attributes, tableHeader);
  const url =
    cell(attributes, JOIN_COLUMNS.resolvedSubmissionUrl) ||
    cell(attributes, urlHeader);
  const teamName = cell(attributes, JOIN_COLUMNS.teamName);

  const consumed = new Set<string>([
    JOIN_COLUMNS.title,
    JOIN_COLUMNS.track,
    JOIN_COLUMNS.tableNumber,
    JOIN_COLUMNS.resolvedSubmissionUrl,
    JOIN_COLUMNS.teamId,
    JOIN_COLUMNS.teamName,
    titleHeader ?? "",
    trackHeader ?? "",
    tableHeader ?? "",
    urlHeader ?? "",
  ]);

  const highlights: AttributeField[] = [];
  for (const highlight of HIGHLIGHTS) {
    const header = headers.find(
      (candidate) => !consumed.has(candidate) && highlight.test(candidate),
    );
    const value = cell(attributes, header ?? null);
    if (!header || !value || isPrivateValue(value)) continue;
    consumed.add(header);
    highlights.push({ label: highlight.label, value });
  }

  const details = headers.flatMap((header) => {
    if (consumed.has(header) || isEmailHeader(header)) return [];
    const value = attributes[header]?.trim() ?? "";
    if (!value || isPrivateValue(value)) return [];
    return [{ label: header, value }];
  });

  return {
    id: row.id,
    title,
    track,
    tableLabel: dashboardTable || csvTable,
    tableNumeric: tableNumberValue(dashboardTable),
    teamName,
    url,
    highlights,
    details,
  };
}

export function trackOptions(rows: readonly JudgingRow[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const track = readTrack(row.attributes);
    if (track) values.add(track);
  }
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function presentRow<T extends JudgingRow>(row: T): T {
  const attributes: JudgingRow["attributes"] = {};
  for (const [header, value] of Object.entries(row.attributes)) {
    if (isEmailHeader(header) || isPrivateValue(value)) continue;
    if (header.toLowerCase() === JOIN_COLUMNS.teamId.toLowerCase()) continue;
    attributes[header] = value;
  }
  return { ...row, attributes };
}

export function presentPair(pair: { pair: [JudgingRow, JudgingRow] }): {
  pair: [JudgingRow, JudgingRow];
} {
  return { pair: [presentRow(pair.pair[0]), presentRow(pair.pair[1])] };
}

export function splitLinks(value: string): string[] {
  return value
    .split(/[\s,]+/u)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//iu.test(part));
}
