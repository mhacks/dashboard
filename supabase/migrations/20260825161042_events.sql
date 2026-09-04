-- Three SECURITY DEFINER helpers, and the definer part is the point.
--
-- `is_event_staff` is the companion to public.is_organizer(), which
-- 20260715023217 added for the realtime policies. An EXISTS over public.users
-- written inline in a policy sends Postgres back through users' own policy and
-- errors with "infinite recursion detected in policy for relation users"; a
-- definer-rights function reads as its owner, so no policy applies and there is
-- nothing to recurse into. See lib/db/schema/rls.ts.
--
-- The other two exist because a volunteer may not read another hacker's rsvp,
-- application, or an event row they have no grant on — the same checks written
-- inline would come back false for everyone and lock the door on real staff.
--
-- Each is wrapped in a SELECT at the call site so the planner evaluates it once
-- per statement rather than once per row, the same reason drizzle renders
-- auth.uid() that way.
CREATE OR REPLACE FUNCTION "public"."is_event_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role IN ('organizer', 'volunteer')
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."is_event_staff"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_event_staff"() TO "authenticated";
--> statement-breakpoint
-- Matches on the `_rsvped` suffix rather than listing the rounds, mirroring
-- hasRsvped() in lib/decisions.ts — which is also what RSVP_CONFIRMED_DECISIONS
-- is derived from. A round added to the enum reaches both at once.
CREATE OR REPLACE FUNCTION "public"."has_confirmed_rsvp"("hacker_id" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hacker_rsvps r
    JOIN public.hacker_applicants a ON a.user_id = r.user_id
    WHERE r.user_id = hacker_id
      AND a.decision IN ('early_rsvped', 'regular_rsvped')
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."has_confirmed_rsvp"(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."has_confirmed_rsvp"(uuid) TO "authenticated";
--> statement-breakpoint
CREATE TYPE "public"."checkin_method" AS ENUM('scan', 'manual');
--> statement-breakpoint
CREATE TYPE "public"."event_scan_outcome" AS ENUM('checked_in', 'already_checked_in', 'unknown_code', 'not_accepted', 'no_rsvp', 'event_closed', 'reverted');
--> statement-breakpoint
CREATE TABLE "event_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by" uuid,
	"method" "checkin_method" DEFAULT 'scan' NOT NULL,
	CONSTRAINT "event_checkins_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_checkins" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "event_scan_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid,
	"scanned_by" uuid,
	"outcome" "event_scan_outcome" NOT NULL,
	"client_scan_id" uuid,
	"raw_code" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_scan_log_client_scan_id_unique" UNIQUE("client_scan_id")
);
--> statement-breakpoint
ALTER TABLE "event_scan_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_checkins_event_time_idx" ON "event_checkins" USING btree ("event_id","checked_in_at");
--> statement-breakpoint
CREATE INDEX "event_scan_log_event_time_idx" ON "event_scan_log" USING btree ("event_id","scanned_at");
--> statement-breakpoint
CREATE POLICY "event_checkins_insert_staff" ON "event_checkins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_event_staff())
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and public.has_confirmed_rsvp("event_checkins"."user_id"));
--> statement-breakpoint
CREATE POLICY "event_checkins_select_own_or_staff" ON "event_checkins" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event_checkins"."user_id" = (select auth.uid()) OR (select public.is_event_staff()));
--> statement-breakpoint
CREATE POLICY "event_checkins_delete_organizer" ON "event_checkins" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_organizer()));
--> statement-breakpoint
CREATE POLICY "event_scan_log_select_staff" ON "event_scan_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_event_staff()));
--> statement-breakpoint
CREATE POLICY "event_scan_log_insert_staff" ON "event_scan_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_event_staff()));
--> statement-breakpoint
CREATE POLICY "events_select_staff" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_event_staff()));
--> statement-breakpoint
CREATE POLICY "events_insert_organizer" ON "events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
CREATE POLICY "events_update_organizer" ON "events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
CREATE POLICY "events_delete_organizer" ON "events" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_organizer()));
--> statement-breakpoint
CREATE TRIGGER "events_set_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
ALTER POLICY "hacker_applicants_select_own_or_organizer" ON "hacker_applicants" TO authenticated USING ("hacker_applicants"."user_id" = (select auth.uid()) OR (select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_applicants_update_organizer" ON "hacker_applicants" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_application_review_events_organizer_select" ON "hacker_application_review_events" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_application_review_events_organizer_insert" ON "hacker_application_review_events" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_application_reviews_organizer_select" ON "hacker_application_reviews" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_application_reviews_organizer_insert" ON "hacker_application_reviews" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_application_reviews_organizer_update" ON "hacker_application_reviews" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "blacklist_organizer_select" ON "blacklist" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "blacklist_organizer_insert" ON "blacklist" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "blacklist_organizer_update" ON "blacklist" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "blacklist_organizer_delete" ON "blacklist" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_send_deliveries_organizer_select" ON "email_send_deliveries" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_send_deliveries_organizer_insert" ON "email_send_deliveries" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_send_deliveries_organizer_update" ON "email_send_deliveries" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_send_runs_organizer_select" ON "email_send_runs" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_send_runs_organizer_insert" ON "email_send_runs" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_send_runs_organizer_update" ON "email_send_runs" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_templates_organizer_select" ON "email_templates" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_templates_organizer_insert" ON "email_templates" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_templates_organizer_update" ON "email_templates" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_templates_organizer_delete" ON "email_templates" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_theme_settings_organizer_select" ON "email_theme_settings" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_theme_settings_organizer_insert" ON "email_theme_settings" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "email_theme_settings_organizer_update" ON "email_theme_settings" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_select_own_or_organizer" ON "hacker_reimbursements" TO authenticated USING ("hacker_reimbursements"."user_id" = (select auth.uid()) OR (select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_organizer_insert" ON "hacker_reimbursements" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_organizer_update" ON "hacker_reimbursements" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_organizer_delete" ON "hacker_reimbursements" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "hacker_rsvps_select_own_or_organizer" ON "hacker_rsvps" TO authenticated USING ("hacker_rsvps"."user_id" = (select auth.uid()) OR (select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "user_invitations_organizer_select" ON "user_invitations" TO authenticated USING ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "user_invitations_organizer_insert" ON "user_invitations" TO authenticated WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "user_invitations_organizer_update" ON "user_invitations" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));
--> statement-breakpoint
ALTER POLICY "users_select_own_or_organizer" ON "users" TO authenticated USING ("users"."id" = (select auth.uid()) OR (select public.is_organizer()));
