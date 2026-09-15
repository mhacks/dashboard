import { pg } from "@/lib/db";
import { ALLOWED_TABLES } from "./sql";

const SCHEMA_NOTES = `Join applicants to users on hacker_applicants.user_id = users.id for applicant email.
Join reviews to users on hacker_application_reviews.reviewer_user_id = users.id for reviewer email.
Join blacklist.created_by_user_id to users.id for who added the entry.
An application is submitted when a hacker_applicants row exists. Drafts in hacker_application_drafts are not submissions.
reviewed_at IS NULL means the scorecard is still a draft.
blacklist is the organizer deny list: match on normalized name OR phone. Amounts in reimbursement_regions are cents.
Only these tables and columns may appear in queries. Columns are loaded from the live database.`;

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
};

let cachedPrompt: { value: string; expiresAt: number } | null = null;
const SCHEMA_TTL_MS = 5 * 60 * 1000;

export async function getDatabaseSchemaPrompt(): Promise<string> {
  const now = Date.now();
  if (cachedPrompt && cachedPrompt.expiresAt > now) {
    return cachedPrompt.value;
  }

  const tables = [...ALLOWED_TABLES];
  const rows = await pg<ColumnRow[]>`
    SELECT table_name, column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${tables})
    ORDER BY table_name, ordinal_position
  `;

  const byTable = new Map<string, ColumnRow[]>();
  for (const table of tables) {
    byTable.set(table, []);
  }
  for (const row of rows) {
    byTable.get(row.table_name)?.push(row);
  }

  const blocks = tables.map((table) => {
    const columns = byTable.get(table) ?? [];
    if (columns.length === 0) {
      return `${table} (\n  -- no public columns found\n)`;
    }
    const lines = columns.map((col) => {
      const type = col.udt_name || col.data_type;
      const nullable = col.is_nullable === "YES" ? " null" : " not null";
      return `  ${col.column_name} ${type}${nullable}`;
    });
    return `${table} (\n${lines.join(",\n")}\n)`;
  });

  const prompt = `Tables (Postgres). Only these tables and columns may appear in FROM/JOIN and SELECT:

${blocks.join("\n\n")}

${SCHEMA_NOTES}
`;

  cachedPrompt = { value: prompt, expiresAt: now + SCHEMA_TTL_MS };
  return prompt;
}
