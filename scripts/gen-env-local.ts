#!/usr/bin/env node
// Append local Supabase env vars to .env.local.
//   pnpm db:local:env

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

let raw: string;
try {
  raw = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    cwd: root,
    encoding: "utf8",
  });
} catch {
  console.error(
    "Could not read `supabase status`. Is the local stack running? Start it with `pnpm db:local`.",
  );
  process.exit(1);
}

const status: Record<string, string> = {};
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m) status[m[1]] = m[2];
}

const supabaseVars: [string, string | undefined][] = [
  ["DATABASE_URL", status["DB_URL"]],
  ["NEXT_PUBLIC_SUPABASE_URL", status["API_URL"]],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", status["PUBLISHABLE_KEY"]],
];

const s3Vars: [string, string][] = [
  ["RESUMES_ACCESS_KEY_ID", status["S3_PROTOCOL_ACCESS_KEY_ID"] ?? ""],
  ["RESUMES_SECRET_ACCESS_KEY", status["S3_PROTOCOL_SECRET_ACCESS_KEY"] ?? ""],
  ["RESUMES_ENDPOINT", status["S3_STORAGE_URL"] ?? ""],
  ["RESUMES_BUCKET", ""],
  ["RESUMES_REGION", "local"],
];

const missing = supabaseVars.filter(([, v]) => v === undefined).map(([k]) => k);
if (missing.length) {
  console.error(`Missing from supabase status: ${missing.join(", ")}`);
  process.exit(1);
}

const cloudflareVars: [string, string][] = [
  ["NEXT_PUBLIC_LOGIN_TURNSTILE_SITE_KEY", "1x00000000000000000000AA"],
  ["LOGIN_TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA"],
];

appendFileSync(
  envPath,
  "\n# Supabase\n" + supabaseVars.map(([k, v]) => `${k}="${v}"`).join("\n") + "\n" +
  "\n# S3\n" + s3Vars.map(([k, v]) => `${k}="${v}"`).join("\n") + "\n" +
  "\n# Cloudflare\n" + cloudflareVars.map(([k, v]) => `${k}="${v}"`).join("\n") + "\n",
);
console.log(`Appended to ${envPath}.`);
