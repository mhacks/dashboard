CREATE TABLE "team_submissions" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"devpost_url" text NOT NULL,
	"submitted_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_submissions" ADD CONSTRAINT "team_submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_submissions" ADD CONSTRAINT "team_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "team_submissions_select_member_or_organizer" ON "team_submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from team_members
        where team_members.team_id = "team_submissions"."team_id"
          and team_members.user_id = (select auth.uid())
      ) OR (select public.is_organizer()));