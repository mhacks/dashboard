CREATE TABLE "hunt_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"ended_at" timestamp with time zone,
	"winner_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hunt_settings_singleton_check" CHECK ("hunt_settings"."id" = 'default')
);
--> statement-breakpoint
ALTER TABLE "hunt_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hunt_settings" ADD CONSTRAINT "hunt_settings_winner_user_id_fkey" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "hunt_settings_authenticated_select" ON "hunt_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "hunt_settings_organizer_all" ON "hunt_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));