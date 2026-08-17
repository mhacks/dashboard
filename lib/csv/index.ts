/*
  CSV in both directions.

  The two features that touch CSV — the admin RSVP export and the email
  campaign recipient list — had grown their own halves of this: serialization
  lived in lib/rsvp/csv.ts, parsing in lib/email/campaigns/recipients.ts, and
  neither knew the other existed. Only the format-level primitives belong
  here; anything that knows what a row *means* (recipient validation, RSVP
  column definitions) stays with its feature.
*/

export type CsvCell =
  string | number | boolean | null | undefined | readonly string[];

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => CsvCell;
};

function stringifyCell(value: CsvCell): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

// Spreadsheet apps execute a leading =, +, -, or @ as a formula when the file
// is opened. Applicant-supplied text lands in these exports verbatim, so the
// cell is prefixed with a quote to force it back to a literal string.
function neutralizeFormula(value: string): string {
  return /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  const safe = neutralizeFormula(value);
  if (!/[",\r\n]/u.test(safe)) return safe;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeCsv<Row>(
  columns: readonly CsvColumn<Row>[],
  rows: readonly Row[],
): string {
  const lines = [
    columns.map((column) => escapeCell(column.header)).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => escapeCell(stringifyCell(column.value(row))))
        .join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/** Splits one CSV line, honouring quoted fields and doubled `""` escapes. */
export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

/**
 * Folds a header cell into a merge-field key: lowercased, spaces to
 * underscores, BOM and punctuation dropped. "First Name" → "first_name".
 */
export function normalizeColumnName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "");
}
