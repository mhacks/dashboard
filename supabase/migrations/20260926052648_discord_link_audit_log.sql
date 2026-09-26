CREATE TABLE "discord_link_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_username" text,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_link_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discord_link_audit_log" ADD CONSTRAINT "discord_link_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discord_link_audit_user_created_at_idx" ON "discord_link_audit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "discord_link_audit_created_at_idx" ON "discord_link_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "discord_link_audit_discord_user_id_idx" ON "discord_link_audit_log" USING btree ("discord_user_id");--> statement-breakpoint
CREATE POLICY "discord_link_audit_select_organizer" ON "discord_link_audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));