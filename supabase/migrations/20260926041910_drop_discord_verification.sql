-- Retires the bot's email-code verification. The RPCs from
-- 20260925203237_discord_verification_rpcs.sql read these tables, and plpgsql
-- bodies aren't tracked as dependencies, so they're dropped explicitly first.
DROP FUNCTION IF EXISTS "public"."discord_issue_code"(text, uuid, text, text, integer, integer, integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."discord_verify_code"(text, text, text, integer);--> statement-breakpoint
DROP TABLE "discord_verification_codes" CASCADE;--> statement-breakpoint
DROP TABLE "discord_verification_sends" CASCADE;
