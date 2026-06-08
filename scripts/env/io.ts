// Side-effecting I/O: reading the Supabase CLI, parsing/writing dotenv files.
// Kept separate from the pure schema/render logic so it's easy to test or swap.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** A flat KEY=value map, as parsed from dotenv text or `supabase status`. */
export type EnvMap = Record<string, string>;

const KV_LINE = /^([A-Z0-9_]+)="?(.*?)"?$/;

/** Parse `KEY=value` / `KEY="value"` lines, ignoring blanks, comments, noise. */
export function parseEnvLines(text: string): EnvMap {
  const map: EnvMap = {};
  for (const line of text.split("\n")) {
    const match = line.match(KV_LINE);
    if (match) map[match[1]] = match[2];
  }
  return map;
}

/** Read the existing .env (empty map if it doesn't exist yet). */
export function readDotenv(path: string): EnvMap {
  return existsSync(path) ? parseEnvLines(readFileSync(path, "utf8")) : {};
}

/**
 * Read live values from the running local Supabase stack.
 * `supabase` is a devDependency, so invoke it via the package runner rather
 * than assuming it's on PATH.
 */
export function readSupabaseStatus(cwd: string): EnvMap {
  let raw: string;
  try {
    raw = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
      cwd,
      encoding: "utf8",
    });
  } catch (err) {
    const detail =
      err instanceof Error && "stderr" in err
        ? String((err as { stderr?: unknown }).stderr ?? err.message)
        : String(err);
    throw new SupabaseUnavailableError(detail);
  }
  return parseEnvLines(raw);
}

/** Thrown when `supabase status` can't be read (stack not running, etc.). */
export class SupabaseUnavailableError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super("Could not read `supabase status`.");
    this.name = "SupabaseUnavailableError";
    this.detail = detail;
  }
}

export function writeEnvFile(path: string, contents: string): void {
  writeFileSync(path, contents);
}
