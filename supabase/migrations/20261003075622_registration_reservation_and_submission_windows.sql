CREATE TABLE "submission_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_settings_singleton_check" CHECK ("submission_settings"."id" = 'default'),
	CONSTRAINT "submission_settings_window_valid" CHECK ("submission_settings"."opens_at" IS NULL
        OR "submission_settings"."closes_at" IS NULL
        OR "submission_settings"."closes_at" > "submission_settings"."opens_at")
);
--> statement-breakpoint
ALTER TABLE "submission_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_registration_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_registration_settings_singleton_check" CHECK ("team_registration_settings"."id" = 'default'),
	CONSTRAINT "team_registration_settings_window_valid" CHECK ("team_registration_settings"."opens_at" IS NULL
        OR "team_registration_settings"."closes_at" IS NULL
        OR "team_registration_settings"."closes_at" > "team_registration_settings"."opens_at")
);
--> statement-breakpoint
ALTER TABLE "team_registration_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_submissions" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"devpost_url" text NOT NULL,
	"submitted_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "team_settings_authenticated_select" ON "team_settings" CASCADE;--> statement-breakpoint
DROP POLICY "team_settings_organizer_all" ON "team_settings" CASCADE;--> statement-breakpoint
DROP TABLE "team_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "reservation_settings" RENAME TO "judging_settings";--> statement-breakpoint
ALTER TABLE "judging_settings" DROP CONSTRAINT "reservation_settings_singleton_check";--> statement-breakpoint
ALTER TABLE "judging_settings" DROP CONSTRAINT "reservation_settings_window_valid";--> statement-breakpoint
ALTER TABLE "judging_settings" DROP CONSTRAINT "reservation_settings_updated_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "submission_settings" ADD CONSTRAINT "submission_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_registration_settings" ADD CONSTRAINT "team_registration_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_submissions" ADD CONSTRAINT "team_submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_submissions" ADD CONSTRAINT "team_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_singleton_check" CHECK ("judging_settings"."id" = 'default');--> statement-breakpoint
ALTER TABLE "judging_settings" ADD CONSTRAINT "judging_settings_window_valid" CHECK ("judging_settings"."reservations_open_at" IS NULL
        OR "judging_settings"."reservations_close_at" IS NULL
        OR "judging_settings"."reservations_close_at" > "judging_settings"."reservations_open_at");--> statement-breakpoint
ALTER POLICY "reservation_settings_authenticated_select" ON "judging_settings" RENAME TO "judging_settings_authenticated_select";--> statement-breakpoint
ALTER POLICY "reservation_settings_organizer_all" ON "judging_settings" RENAME TO "judging_settings_organizer_all";--> statement-breakpoint
CREATE POLICY "submission_settings_authenticated_select" ON "submission_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()) OR (select public.has_accepted_reservation_access()));--> statement-breakpoint
CREATE POLICY "submission_settings_organizer_all" ON "submission_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "team_registration_settings_authenticated_select" ON "team_registration_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()) OR (select public.has_accepted_reservation_access()));--> statement-breakpoint
CREATE POLICY "team_registration_settings_organizer_all" ON "team_registration_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "team_submissions_select_member_or_organizer" ON "team_submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from team_members
        where team_members.team_id = "team_submissions"."team_id"
          and team_members.user_id = (select auth.uid())
      ) OR (select public.is_organizer()));