-- Whether a given user (not the caller -- that is is_organizer()) is an
-- organizer. The check-in insert policy exempts organizers from the RSVP gate
-- and the per-event scan cap, and a volunteer evaluating that policy can only
-- see their own public.users row, so the lookup has to run with definer rights.
-- Same shape as has_confirmed_rsvp(), for the same reason.
CREATE OR REPLACE FUNCTION "public"."is_organizer_user"("target_id" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_id
      AND role = 'organizer'
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."is_organizer_user"(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_organizer_user"(uuid) TO "authenticated";
--> statement-breakpoint
ALTER POLICY "event_checkins_insert_staff" ON "event_checkins" TO authenticated WITH CHECK ((select public.is_event_staff())
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and (
    public.has_confirmed_rsvp("event_checkins"."user_id")
    or public.is_organizer_user("event_checkins"."user_id")
    or exists (
      select 1 from public.events event
      where event.id = "event_checkins"."event_id" and not event.requires_rsvp
    )
  )
  and (
    public.is_organizer_user("event_checkins"."user_id")
    or exists (
      select 1 from public.events event
      where event.id = "event_checkins"."event_id"
        and "event_checkins"."scan_number" <= event.max_checkins
    )
  )
  and public.is_event_open("event_checkins"."event_id"));