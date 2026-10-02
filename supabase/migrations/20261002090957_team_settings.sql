CREATE TABLE "team_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"formation_enabled" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_settings_singleton_check" CHECK ("team_settings"."id" = 'default')
);
--> statement-breakpoint
ALTER TABLE "team_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "team_settings_authenticated_select" ON "team_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "team_settings_organizer_all" ON "team_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));