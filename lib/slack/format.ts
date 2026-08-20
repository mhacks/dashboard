const MAX_CELL_CHARS = 60;
const MAX_MESSAGE_CHARS = 3500;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "string"
      ? value
      : (JSON.stringify(value) ?? String(value));
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_CELL_CHARS) return collapsed;
  return `${collapsed.slice(0, MAX_CELL_CHARS - 1)}…`;
}

export function formatQueryRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "No rows returned.";
  const columns = Object.keys(rows[0]);
  const header = columns.join(" | ");
  const divider = columns.map(() => "---").join(" | ");
  const body = rows.map((row) =>
    columns.map((col) => cell(row[col])).join(" | "),
  );
  const table = [header, divider, ...body].join("\n");
  const fenced = `\`\`\`\n${table}\n\`\`\``;
  if (fenced.length <= MAX_MESSAGE_CHARS) return fenced;
  return `${fenced.slice(0, MAX_MESSAGE_CHARS - 1)}…`;
}

export function stripBotMention(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
