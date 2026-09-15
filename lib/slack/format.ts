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
  const fence = (included: string[], omitted: number) => {
    const table = [header, divider, ...included].join("\n");
    const fenced = `\`\`\`\n${table}\n\`\`\``;
    if (omitted <= 0) return fenced;
    const noun = omitted === 1 ? "row" : "rows";
    return `${fenced}\n_${omitted} more ${noun} omitted._`;
  };

  let included = body;
  while (included.length > 0) {
    const text = fence(included, body.length - included.length);
    if (text.length <= MAX_MESSAGE_CHARS) return text;
    included = included.slice(0, -1);
  }
  return "Result too large to display.";
}

export function truncateSlackText(text: string, max = 3900): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max - 4).trimEnd();
  const fences = truncated.match(/```/g)?.length ?? 0;
  if (fences % 2 === 1) {
    return `${truncated}\n\`\`\``;
  }
  return `${truncated}…`;
}

export function stripBotMention(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
