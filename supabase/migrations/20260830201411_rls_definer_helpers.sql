-- The companion to public.is_organizer(), which 20260715023217 already added
-- for the realtime policies. Everything else in the schema was still inlining
-- an EXISTS over public.users, which recurses when the reader is `authenticated`
-- because public.users carries a policy of its own. See lib/db/schema/rls.ts.
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
ALTER POLICY "hacker_applicants_select_own_or_organizer" ON "hacker_applicants" TO authenticated USING ("hacker_applicants"."user_id" = (select auth.uid()) OR (select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_applicants_update_organizer" ON "hacker_applicants" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_application_review_events_organizer_select" ON "hacker_application_review_events" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_application_review_events_organizer_insert" ON "hacker_application_review_events" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_application_reviews_organizer_select" ON "hacker_application_reviews" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_application_reviews_organizer_insert" ON "hacker_application_reviews" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_application_reviews_organizer_update" ON "hacker_application_reviews" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "blacklist_organizer_select" ON "blacklist" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "blacklist_organizer_insert" ON "blacklist" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "blacklist_organizer_update" ON "blacklist" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "blacklist_organizer_delete" ON "blacklist" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_send_deliveries_organizer_select" ON "email_send_deliveries" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_send_deliveries_organizer_insert" ON "email_send_deliveries" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_send_deliveries_organizer_update" ON "email_send_deliveries" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_send_runs_organizer_select" ON "email_send_runs" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_send_runs_organizer_insert" ON "email_send_runs" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_send_runs_organizer_update" ON "email_send_runs" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_templates_organizer_select" ON "email_templates" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_templates_organizer_insert" ON "email_templates" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_templates_organizer_update" ON "email_templates" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_templates_organizer_delete" ON "email_templates" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_theme_settings_organizer_select" ON "email_theme_settings" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_theme_settings_organizer_insert" ON "email_theme_settings" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "email_theme_settings_organizer_update" ON "email_theme_settings" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "event_checkins_select_own_or_staff" ON "event_checkins" TO authenticated USING ("event_checkins"."user_id" = (select auth.uid()) OR (select public.is_event_staff()));--> statement-breakpoint
ALTER POLICY "event_checkins_insert_staff" ON "event_checkins" TO authenticated WITH CHECK ((select public.is_event_staff())
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and public.has_confirmed_rsvp("event_checkins"."user_id"));--> statement-breakpoint
ALTER POLICY "event_checkins_delete_organizer" ON "event_checkins" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "event_scan_log_select_staff" ON "event_scan_log" TO authenticated USING ((select public.is_event_staff()));--> statement-breakpoint
ALTER POLICY "event_scan_log_insert_staff" ON "event_scan_log" TO authenticated WITH CHECK ((select public.is_event_staff()));--> statement-breakpoint
ALTER POLICY "events_select_staff" ON "events" TO authenticated USING ((select public.is_event_staff()));--> statement-breakpoint
ALTER POLICY "events_insert_organizer" ON "events" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "events_update_organizer" ON "events" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "events_delete_organizer" ON "events" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_select_own_or_organizer" ON "hacker_reimbursements" TO authenticated USING ("hacker_reimbursements"."user_id" = (select auth.uid()) OR (select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_organizer_insert" ON "hacker_reimbursements" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_organizer_update" ON "hacker_reimbursements" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_reimbursements_organizer_delete" ON "hacker_reimbursements" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "hacker_rsvps_select_own_or_organizer" ON "hacker_rsvps" TO authenticated USING ("hacker_rsvps"."user_id" = (select auth.uid()) OR (select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "user_invitations_organizer_select" ON "user_invitations" TO authenticated USING ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "user_invitations_organizer_insert" ON "user_invitations" TO authenticated WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "user_invitations_organizer_update" ON "user_invitations" TO authenticated USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
ALTER POLICY "users_select_own_or_organizer" ON "users" TO authenticated USING ("users"."id" = (select auth.uid()) OR (select public.is_organizer()));