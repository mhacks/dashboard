-- Closing an event is the switch that stops a door, so it has to bind the
-- direct-to-PostgREST path too, not just the server action. SECURITY DEFINER
-- because a volunteer has no grant of their own on events.
CREATE OR REPLACE FUNCTION "public"."is_event_open"("event" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event AND e.is_active
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."is_event_open"(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_event_open"(uuid) TO "authenticated";
--> statement-breakpoint
-- Match on the `_rsvped` suffix rather than listing the rounds, mirroring
-- hasRsvped() in lib/decisions.ts, which RSVP_CONFIRMED_DECISIONS is now
-- derived from. A round added to the enum reaches both at once.
CREATE OR REPLACE FUNCTION "public"."has_confirmed_rsvp"("hacker_id" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hacker_rsvps r
    JOIN public.hacker_applicants a ON a.user_id = r.user_id
    WHERE r.user_id = hacker_id
      AND a.decision::text LIKE '%\_rsvped'
  );
$$;
--> statement-breakpoint
-- Two lineages reach this migration, and the swap has to land on both.
--
-- 20260825161042_events.sql shipped once with the global constraint and was
-- then edited in place to carry the composite one, so a database migrated in
-- between already created event_scan_log with the composite constraint and has
-- no "..._client_scan_id_unique" to drop. A bare DROP errors there with
-- `constraint ... does not exist`, and because the whole file runs in one
-- transaction it takes the check-in guards below down with it -- which is what
-- left /checkin and the event pages broken.
--
-- Dropping both names IF EXISTS and adding the one we want makes the end state
-- identical whichever version of the events migration a database ran.
ALTER TABLE "event_scan_log" DROP CONSTRAINT IF EXISTS "event_scan_log_client_scan_id_unique";--> statement-breakpoint
ALTER TABLE "event_scan_log" DROP CONSTRAINT IF EXISTS "event_scan_log_event_client_scan_unique";--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_event_client_scan_unique" UNIQUE("event_id","client_scan_id");--> statement-breakpoint
ALTER POLICY "event_checkins_insert_staff" ON "event_checkins" TO authenticated WITH CHECK ((select public.is_event_staff())
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and public.has_confirmed_rsvp("event_checkins"."user_id")
  and public.is_event_open("event_checkins"."event_id"));--> statement-breakpoint
ALTER POLICY "event_scan_log_insert_staff" ON "event_scan_log" TO authenticated WITH CHECK ((select public.is_event_staff()) and "event_scan_log"."scanned_by" = (select auth.uid()));