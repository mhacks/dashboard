#!/usr/bin/env node
// Generate the local-development .env from the running local Supabase stack.
//
//   pnpm db:env
//
// Thin CLI: orchestrates io -> resolve -> render -> write and turns the typed
// errors into friendly, actionable messages. The interesting logic lives in
// ./env/{schema,io,resolve,render}.ts — edit schema.ts to add a variable.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { schema } from "./env/schema.ts";
import {
  SupabaseUnavailableError,
  readDotenv,
  readSupabaseStatus,
  writeEnvFile,
} from "./env/io.ts";
import { MissingStatusKeyError, resolveValues } from "./env/resolve.ts";
import { renderEnvFile } from "./env/render.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

try {
  const status = readSupabaseStatus(root);
  const existing = readDotenv(envPath);
  const values = resolveValues(schema, { status, existing });

  writeEnvFile(envPath, renderEnvFile(schema, values));
  console.log(`Wrote ${envPath} from local Supabase status.`);
} catch (err) {
  if (err instanceof SupabaseUnavailableError) {
    fail(
      `${err.message}\n` +
        "Is the local stack running? Start it with `pnpm db:local`, " +
        "then re-run `pnpm db:env`.\n\n" +
        err.detail,
    );
  }
  if (err instanceof MissingStatusKeyError) {
    fail(
      `${err.message}\n` +
        "Update the Supabase CLI (`pnpm add -D supabase@latest`) and try again.",
    );
  }
  throw err;
}
