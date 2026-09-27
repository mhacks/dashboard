-- Retires the RPCs the Discord bot used to call. It now reaches the database
-- only through the dashboard's /discord_auth/claim route, which queries with
-- Drizzle (lib/queries/discord.ts) and writes with lib/actions/discord-link.actions.ts.
--
-- They were unreachable regardless: the Supabase Data API is disabled, and these
-- were granted to service_role alone. Hand-written because drizzle-kit does not
-- emit functions, as with every other discord_* migration.
DROP FUNCTION IF EXISTS "public"."discord_lookup_member"(text);--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."discord_lookup_by_discord_id"(text);--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."link_discord_account"(uuid, text, text);
