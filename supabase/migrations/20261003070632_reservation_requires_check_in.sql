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
