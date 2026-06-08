// Pure rendering: turn the schema + resolved values into .env file text.
// No I/O here, so this is trivially testable.

import type { EnvSection } from "./schema.ts";

const HEADER = `# AUTO-GENERATED for local development by \`pnpm db:env\` — do not edit by hand.
# Pulls live values from the running local Supabase stack (\`supabase status\`).
# Re-run \`pnpm db:env\` after \`pnpm db:local\` if these ever drift.`;

/** Prefix every line of a (possibly multi-line) comment with "# ". */
function commentBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `# ${line}` : "#"))
    .join("\n");
}

/**
 * Render the full .env contents. `values` maps each variable name to its
 * already-resolved value (see resolve.ts).
 */
export function renderEnvFile(
  sections: readonly EnvSection[],
  values: Readonly<Record<string, string>>,
): string {
  const blocks = sections.map((section) => {
    const lines: string[] = [`# --- ${section.title} ---`];
    if (section.description) lines.push(commentBlock(section.description));

    for (const v of section.vars) {
      if (v.comment) lines.push(commentBlock(v.comment));
      lines.push(`${v.name}="${values[v.name]}"`);
    }
    return lines.join("\n");
  });

  return `${HEADER}\n\n${blocks.join("\n\n")}\n`;
}
