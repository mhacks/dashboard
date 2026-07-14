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
CREATE POLICY "users_select_own_or_organizer" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()) OR exists (
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