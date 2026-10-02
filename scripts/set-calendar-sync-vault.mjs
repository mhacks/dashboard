// Gives pg_cron what it needs to call the sync-live-calendar edge function:
// the project URL and the shared secret, stored in Vault (see the
// calendar_sync_cron migration). Run by CD after the function is deployed, so
// the job never starts calling a function that isn't there yet. Idempotent.

import postgres from "postgres";

const { DATABASE_URL, SUPABASE_PROJECT_REF, CALENDAR_SYNC_SECRET } =
  process.env;
if (!DATABASE_URL || !SUPABASE_PROJECT_REF || !CALENDAR_SYNC_SECRET) {
  throw new Error(
    "DATABASE_URL, SUPABASE_PROJECT_REF and CALENDAR_SYNC_SECRET are required.",
  );
}

const secrets = {
  project_url: `https://${SUPABASE_PROJECT_REF}.supabase.co`,
  calendar_sync_secret: CALENDAR_SYNC_SECRET,
};

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });
try {
  for (const [name, value] of Object.entries(secrets)) {
    const [existing] =
      await sql`select id from vault.secrets where name = ${name}`;
    if (existing)
      await sql`select vault.update_secret(${existing.id}, ${value})`;
    else await sql`select vault.create_secret(${value}, ${name})`;
    console.log(`Vault secret ${name} ${existing ? "updated" : "created"}.`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
