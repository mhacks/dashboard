export class CsvSchemaError extends Error {
  readonly headers: string[];

  constructor(message: string, headers: string[] = []) {
    super(message);
    this.name = "CsvSchemaError";
    this.headers = headers;
  }
}

export type CsvTable = {
  headers: string[];
  records: Record<string, string>[];
  /** Blank or duplicated headers renamed so MDredd will accept the file. */
  renamedHeaders: string[];
};

/** RFC 4180 parser. Quoted fields may contain commas and newlines. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/u, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }
    field += char ?? "";
  }

  if (inQuotes) {
    throw new CsvSchemaError("The CSV has an unterminated quoted field.");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last && last.length === 1 && last[0] === "") {
      rows.pop();
      continue;
    }
    break;
  }
  return rows;
}

function escapeCell(value: string): string {
  if (!/[",\r\n]/u.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

export function serializeCsv(
  headers: readonly string[],
  records: readonly Record<string, string>[],
): string {
  const lines = [
    headers.map((header) => escapeCell(header)).join(","),
    ...records.map((record) =>
      headers.map((header) => escapeCell(record[header] ?? "")).join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function csvTable(text: string): CsvTable {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new CsvSchemaError("The CSV is empty.");
  }
  const rawHeaders = rows[0]?.map((header) => header.trim()) ?? [];
  if (rawHeaders.length === 0 || rawHeaders.every((header) => header === "")) {
    throw new CsvSchemaError("The CSV needs a header row.");
  }
  const { headers, renamedHeaders } = repairHeaders(rawHeaders);

  const records = rows.slice(1).map((row, rowIndex) => {
    if (row.length > headers.length) {
      throw new CsvSchemaError(
        `Row ${rowIndex + 2} has ${row.length} cells and the header has ${headers.length}.`,
        headers,
      );
    }
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });

  if (records.length < 2) {
    throw new CsvSchemaError("The CSV needs at least two projects.", headers);
  }

  return { headers, records, renamedHeaders };
}

/**
 * Devpost's export leaves the extra team-member columns unnamed (`...` plus
 * blank headers). MDredd rejects empty or duplicated headers, so blank ones
 * get a stable `unnamed_<column>` name and duplicates get a numeric suffix.
 */
function repairHeaders(rawHeaders: readonly string[]): {
  headers: string[];
  renamedHeaders: string[];
} {
  const headers: string[] = [];
  const renamedHeaders: string[] = [];
  const used = new Set<string>();

  rawHeaders.forEach((header, index) => {
    const original = header.trim();
    const name = original || `unnamed_${index + 1}`;
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${name}_${suffix}`;
      suffix += 1;
    }
    if (candidate !== original) {
      renamedHeaders.push(
        original
          ? `"${original}" was renamed to ${candidate} because that header was duplicated.`
          : `Column ${index + 1} had a blank header and was named ${candidate}.`,
      );
    }
    used.add(candidate.toLowerCase());
    headers.push(candidate);
  });

  return { headers, renamedHeaders };
}
