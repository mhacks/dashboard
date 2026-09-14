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

const FORBIDDEN_WORDS = new Set([
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "grant",
  "revoke",
  "truncate",
  "copy",
  "execute",
  "call",
  "do",
  "vacuum",
  "lock",
  "notify",
  "listen",
  "load",
  "discard",
  "prepare",
  "deallocate",
  "reindex",
  "cluster",
  "refresh",
  "comment",
  "security",
  "set",
  "show",
  "explain",
  "into",
]);

const FORBIDDEN_FUNCS = new Set([
  "set_config",
  "pg_read_file",
  "pg_ls_dir",
  "lo_import",
  "lo_get",
  "dblink",
  "dblink_exec",
]);

const TABLE_FOLLOWERS = new Set([
  "where",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "cross",
  "natural",
  "on",
  "using",
  "group",
  "order",
  "limit",
  "offset",
  "having",
  "union",
  "except",
  "intersect",
  "window",
  "fetch",
  "for",
  "tablesample",
  "as",
  "only",
  "lateral",
]);

type Token =
  | { type: "word"; value: string }
  | { type: "quoted"; value: string }
  | { type: "string" }
  | { type: "punct"; value: string };

export type SqlResult =
  | { ok: true; rows: Record<string, unknown>[]; rowCount: number }
  | { ok: false; error: string };

export function validateReadonlySelect(sql: string): string {
  const trimmed = sql.replace(/;+\s*$/, "").trim();
  if (!trimmed) {
    throw new Error("Empty query");
  }

  const tokens = tokenizeSql(trimmed);
  if (tokens.length === 0) {
    throw new Error("Empty query");
  }
  if (tokens.some((token) => token.type === "quoted")) {
    throw new Error("Quoted identifiers are not allowed");
  }
  if (tokens.some((token) => token.type === "punct" && token.value === ";")) {
    throw new Error("Multiple statements are not allowed");
  }

  const first = tokens.find(
    (token): token is Extract<Token, { type: "word" }> => token.type === "word",
  );
  if (!first || (first.value !== "select" && first.value !== "with")) {
    throw new Error("Only SELECT or WITH … SELECT queries are allowed");
  }

  checkForbidden(tokens);
  const cteNames = extractCteNames(tokens);
  const tables = extractTableNames(tokens);
  for (const table of tables) {
    if (cteNames.has(table)) continue;
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Table "${table}" is not allowed`);
    }
  }

  return trimmed;
}

function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    const c = sql[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "-" && sql[i + 1] === "-") {
      i += 2;
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }

    if (c === "/" && sql[i + 1] === "*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
          continue;
        }
        if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
          continue;
        }
        i++;
      }
      if (depth !== 0) {
        throw new Error("Unterminated comment");
      }
      continue;
    }

    if (c === "$") {
      const tag = sql.slice(i).match(/^(\$[a-zA-Z_]*\$)/);
      if (tag) {
        const end = sql.indexOf(tag[1], i + tag[1].length);
        if (end === -1) {
          throw new Error("Unterminated dollar-quoted string");
        }
        i = end + tag[1].length;
        tokens.push({ type: "string" });
        continue;
      }
    }

    if (c === '"') {
      i++;
      let ident = "";
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          ident += '"';
          i += 2;
          continue;
        }
        if (sql[i] === '"') {
          i++;
          break;
        }
        ident += sql[i];
        i++;
      }
      tokens.push({ type: "quoted", value: ident });
      continue;
    }

    if (c === "'" || ((c === "E" || c === "e") && sql[i + 1] === "'")) {
      if (c !== "'") i++;
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) {
        throw new Error("Unterminated string literal");
      }
      tokens.push({ type: "string" });
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /[\w$]/.test(sql[j])) j++;
      tokens.push({ type: "word", value: sql.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }

    tokens.push({ type: "punct", value: c });
    i++;
  }

  return tokens;
}

function isWord(
  token: Token | undefined,
): token is Extract<Token, { type: "word" }> {
  return token?.type === "word";
}

function isPunct(
  token: Token | undefined,
  value?: string,
): token is Extract<Token, { type: "punct" }> {
  return (
    token?.type === "punct" && (value === undefined || token.value === value)
  );
}

function checkForbidden(tokens: Token[]): void {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!isWord(token)) continue;

    if (FORBIDDEN_WORDS.has(token.value)) {
      throw new Error("Query contains a forbidden keyword");
    }

    if (token.value === "for") {
      const next = nextWord(tokens, i + 1);
      if (next && ["update", "share", "no", "key"].includes(next)) {
        throw new Error("Query contains a forbidden keyword");
      }
    }

    if (FORBIDDEN_FUNCS.has(token.value) && isPunct(tokens[i + 1], "(")) {
      throw new Error("Query contains a forbidden function");
    }
  }
}

function wordAt(tokens: Token[], i: number): string | undefined {
  const token = tokens[i];
  return isWord(token) ? token.value : undefined;
}

function nextWord(tokens: Token[], start: number): string | undefined {
  for (let i = start; i < tokens.length; i++) {
    const value = wordAt(tokens, i);
    if (value) return value;
  }
  return undefined;
}

function extractCteNames(tokens: Token[]): Set<string> {
  const names = new Set<string>();
  if (wordAt(tokens, 0) !== "with") return names;

  let i = 1;
  if (wordAt(tokens, i) === "recursive") i++;

  while (i < tokens.length) {
    const name = wordAt(tokens, i);
    if (!name) break;
    i++;
    if (isPunct(tokens[i], "(")) {
      i = skipParens(tokens, i);
    }
    if (wordAt(tokens, i) !== "as") break;
    i++;
    if (!isPunct(tokens[i], "(")) break;
    i = skipParens(tokens, i);
    names.add(name);
    if (isPunct(tokens[i], ",")) {
      i++;
      continue;
    }
    break;
  }

  return names;
}

function extractTableNames(tokens: Token[]): string[] {
  const names: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (
      token.type !== "word" ||
      (token.value !== "from" && token.value !== "join")
    ) {
      continue;
    }

    const fromList = token.value === "from";
    i++;
    while (["only", "lateral"].includes(wordAt(tokens, i) ?? "")) {
      i++;
    }

    if (isPunct(tokens[i], "(")) {
      i = skipParens(tokens, i) - 1;
      i = skipAlias(tokens, i + 1) - 1;
      if (fromList && isComma(tokens[i + 1])) {
        throw new Error("Comma-separated FROM lists are not allowed");
      }
      continue;
    }

    const parsed = parseQualifiedName(tokens, i);
    if (!parsed) continue;
    names.push(parsed.name);
    i = skipAlias(tokens, parsed.next) - 1;
    if (fromList && isComma(tokens[i + 1])) {
      throw new Error("Comma-separated FROM lists are not allowed");
    }
  }
  return names;
}

function parseQualifiedName(
  tokens: Token[],
  i: number,
): { name: string; next: number } | null {
  if (tokens[i]?.type === "quoted") {
    throw new Error("Quoted identifiers are not allowed");
  }
  const table = tokens[i];
  if (!isWord(table)) return null;

  const first = table.value;
  const second = tokens[i + 2];
  if (
    isPunct(tokens[i + 1], ".") &&
    (isWord(second) || second?.type === "quoted")
  ) {
    if (second.type === "quoted") {
      throw new Error("Quoted identifiers are not allowed");
    }
    if (first !== "public") {
      throw new Error(`Schema "${first}" is not allowed`);
    }
    return { name: second.value, next: i + 3 };
  }

  return { name: first, next: i + 1 };
}

function skipAlias(tokens: Token[], i: number): number {
  if (wordAt(tokens, i) === "as") {
    if (tokens[i + 1]?.type === "quoted") {
      throw new Error("Quoted identifiers are not allowed");
    }
    if (isWord(tokens[i + 1])) return i + 2;
    return i + 1;
  }
  const alias = wordAt(tokens, i);
  if (alias && !TABLE_FOLLOWERS.has(alias)) {
    return i + 1;
  }
  return i;
}

function skipParens(tokens: Token[], i: number): number {
  if (!isPunct(tokens[i], "(")) {
    throw new Error("Unbalanced parentheses");
  }
  let depth = 0;
  for (; i < tokens.length; i++) {
    const token = tokens[i];
    if (!isPunct(token)) continue;
    if (token.value === "(") depth++;
    else if (token.value === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("Unbalanced parentheses");
}

function isComma(token: Token | undefined): boolean {
  return isPunct(token, ",");
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
