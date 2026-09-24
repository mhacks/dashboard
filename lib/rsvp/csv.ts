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
