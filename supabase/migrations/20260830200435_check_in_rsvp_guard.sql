CREATE OR REPLACE FUNCTION "public"."has_confirmed_rsvp"("hacker_id" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  -- SECURITY DEFINER on purpose. A volunteer may not read another hacker's
  -- rsvp or application row, so the same EXISTS written inline in the policy
  -- would come back false for everyone and lock the door on real staff.
  --
  -- Mirrors RSVP_CONFIRMED_DECISIONS in lib/decisions.ts, which is the check
  -- the check-in path applies in TypeScript. Change one, change the other.
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
ALTER POLICY "event_checkins_insert_staff" ON "event_checkins" TO authenticated WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role in ('organizer', 'volunteer')
)
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and public.has_confirmed_rsvp("event_checkins"."user_id"));