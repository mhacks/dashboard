import { pg } from "@/lib/db";

export const SQL_ROW_LIMIT = 25;

const ALLOWED_TABLES = new Set([
  "hacker_applicants",
  "hacker_application_reviews",
  "hacker_application_review_events",
  "hacker_application_drafts",
  "users",
  "blacklist",
  "reimbursement_regions",
]);

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|vacuum|lock|notify|listen|load|discard|prepare|deallocate|reindex|cluster|refresh|comment|security|set|show|explain|into|for\s+update|for\s+share)\b/i;

export type SqlResult =
  | { ok: true; rows: Record<string, unknown>[]; rowCount: number }
  | { ok: false; error: string };

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateReadonlySelect(sql: string): string {
  const stripped = stripSqlComments(sql).replace(/;+\s*$/, "");
  if (!stripped) {
    throw new Error("Empty query");
  }
  if (stripped.includes(";")) {
    throw new Error("Multiple statements are not allowed");
  }
  if (!/^(with|select)\b/i.test(stripped)) {
    throw new Error("Only SELECT or WITH … SELECT queries are allowed");
  }
  if (FORBIDDEN.test(stripped)) {
    throw new Error("Query contains a forbidden keyword");
  }

  const cteNames = extractCteNames(stripped);
  const tables = extractTableNames(stripped);
  for (const table of tables) {
    if (cteNames.has(table)) continue;
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Table "${table}" is not allowed`);
    }
  }

  return stripped;
}

function extractCteNames(sql: string): Set<string> {
  const names = new Set<string>();
  const withMatch = sql.match(/^with\s+(recursive\s+)?/i);
  if (!withMatch) return names;

  const afterWith = sql.slice(withMatch[0].length);
  const ctePattern = /([a-zA-Z_][\w]*)\s*(?:\([^)]*\))?\s+as\s*\(/gi;
  let depth = 0;
  let consumed = 0;
  for (let i = 0; i < afterWith.length; i++) {
    const ch = afterWith[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /^select\b/i.test(afterWith.slice(i))) {
      consumed = i;
      break;
    }
  }
  const cteSection = afterWith.slice(0, consumed || afterWith.length);
  for (const match of cteSection.matchAll(ctePattern)) {
    names.add(match[1].toLowerCase());
  }
  return names;
}

function extractTableNames(sql: string): string[] {
  const names: string[] = [];
  const skip = new Set(["lateral"]);
  const pattern = /\b(?:from|join)\s+(?:only\s+)?([a-zA-Z_][\w.]*)/gi;
  for (const match of sql.matchAll(pattern)) {
    const qualified = match[1].toLowerCase();
    if (skip.has(qualified)) continue;
    const parts = qualified.split(".");
    if (parts.length === 2 && parts[0] !== "public") {
      throw new Error(`Schema "${parts[0]}" is not allowed`);
    }
    names.push(parts[parts.length - 1]);
  }
  return names;
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value;
}

export async function runReadonlySql(sql: string): Promise<SqlResult> {
  let validated: string;
  try {
    validated = validateReadonlySelect(sql);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid SQL",
    };
  }

  const wrapped = `SELECT * FROM (${validated}) AS q LIMIT ${SQL_ROW_LIMIT}`;

  try {
    const rows = await pg.begin(async (tx) => {
      await tx.unsafe("SET LOCAL statement_timeout = '5s'");
      await tx.unsafe("SET LOCAL transaction_read_only = on");
      return await tx.unsafe(wrapped);
    });

    const plain = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        out[key] = serializeValue(value);
      }
      return out;
    });

    return { ok: true, rows: plain, rowCount: plain.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Query failed",
    };
  }
}
