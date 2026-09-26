-- Silences the `schema "pg_pgrst_no_exposed_schemas" does not exist` (3F000)
-- errors PostgREST has logged every ~32s since the Data API was disabled (#180).
-- Hosted Supabase doesn't stop PostgREST when the Data API is off; it points it
-- at that nonexistent placeholder schema, so the schema-cache load fails and
-- retries forever. Giving it a real, empty schema lets the load succeed with
-- nothing to serve. The Data API stays disabled, so nothing becomes reachable.
-- https://supabase.com/docs/guides/troubleshooting/schema-pg_pgrst_no_exposed_schemas-does-not-exist
--
-- While this override is set, the dashboard's "Exposed schemas" setting is
-- ignored. Before re-enabling the Data API ([api] enabled in config.toml), run:
--   alter role authenticator reset pgrst.db_schemas;
--   notify pgrst;
-- Hand-written because drizzle-kit does not emit role settings.
CREATE SCHEMA IF NOT EXISTS "pgrst_no_exposed_schemas";--> statement-breakpoint
REVOKE ALL ON SCHEMA "pgrst_no_exposed_schemas" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
ALTER ROLE authenticator SET pgrst.db_schemas = 'pgrst_no_exposed_schemas';--> statement-breakpoint
NOTIFY pgrst;
