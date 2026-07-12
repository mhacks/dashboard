// Registers a manual OAuth client for local testing (DCR is off — see
// supabase/config.toml's [auth.oauth_server]). Local only: refuses to run
// against a non-local NEXT_PUBLIC_SUPABASE_URL so a service-role key never
// gets pointed at prod from this script.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<from `pnpm supabase status`> \
//     node --env-file=.env.local scripts/register-mcp-client.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(supabaseUrl)) {
  console.error(
    `Refusing to run: NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") doesn't look local. ` +
      "This script is for local testing only — register prod clients via the dashboard.",
  );
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Get it from `pnpm supabase status` " +
      '("service_role key") — gen-env-local.sh does not write it to .env.local.',
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await admin.auth.admin.oauth.createClient({
  client_name: "MCP Inspector (local test)",
  redirect_uris: ["http://localhost:6274/oauth/callback"],
  token_endpoint_auth_method: "none", // public client + PKCE, matches Inspector
});

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(data);
