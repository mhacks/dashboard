CREATE TYPE "public"."review_event_type" AS ENUM('draft_saved', 'review_completed');--> statement-breakpoint
CREATE TABLE "hacker_application_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"event_type" "review_event_type" NOT NULL,
	"changes" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hacker_application_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"effort_rating" integer,
	"builder_rating" integer,
	"flagged_for_review" boolean DEFAULT false NOT NULL,
	"review_comments" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_application_reviews_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."hacker_application_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ADD CONSTRAINT "hacker_application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ADD CONSTRAINT "hacker_application_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hacker_application_review_events_application_id_created_at_idx" ON "hacker_application_review_events" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE POLICY "hacker_applicants_select_own_or_organizer" ON "hacker_applicants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_applicants"."user_id" = (select auth.uid()) OR exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_applicants_insert_own" ON "hacker_applicants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("hacker_applicants"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "hacker_applicants_update_organizer" ON "hacker_applicants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
)) WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_application_drafts_select_own" ON "hacker_application_drafts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_application_drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "hacker_application_drafts_insert_own" ON "hacker_application_drafts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("hacker_application_drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "hacker_application_drafts_update_own" ON "hacker_application_drafts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("hacker_application_drafts"."user_id" = (select auth.uid())) WITH CHECK ("hacker_application_drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "hacker_application_drafts_delete_own" ON "hacker_application_drafts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("hacker_application_drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_select_own_or_organizer" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()) OR exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_application_review_events_organizer_select" ON "hacker_application_review_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_application_review_events_organizer_insert" ON "hacker_application_review_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_application_reviews_organizer_select" ON "hacker_application_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_application_reviews_organizer_insert" ON "hacker_application_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_application_reviews_organizer_update" ON "hacker_application_reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
)) WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "organizers_receive_review_realtime" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
) AND (
  realtime.topic() = 'application-review:dashboard'
  OR realtime.topic() LIKE 'application-review:%'
));--> statement-breakpoint
CREATE POLICY "organizers_send_review_realtime" ON "realtime"."messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
) AND (
  realtime.topic() = 'application-review:dashboard'
  OR realtime.topic() LIKE 'application-review:%'
));