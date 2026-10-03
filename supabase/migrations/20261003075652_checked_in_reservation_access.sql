-- Table reservation is for checked-in hackers. The app actions use the same
-- rule. This function is what the tables and judging_settings select policies
-- call, so a signed-in client cannot read them before check-in either.
CREATE OR REPLACE FUNCTION "public"."has_accepted_reservation_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hacker_applicants
    WHERE user_id = (SELECT auth.uid())
      AND decision::text = 'checked_in'
  );
$$;
--> statement-breakpoint
-- Grants and triggers are not generated from the Drizzle table schema.
-- New public tables are granted to anon by default. Take that back: only a
-- signed-in user may select these rows, and only an organizer may write them.
REVOKE ALL ON TABLE "public"."submission_settings" FROM "anon";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."submission_settings" TO "authenticated";
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."team_registration_settings" FROM "anon";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."team_registration_settings" TO "authenticated";
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."team_submissions" FROM "anon";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."team_submissions" TO "authenticated";
