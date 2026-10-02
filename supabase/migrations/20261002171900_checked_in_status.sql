ALTER TYPE "public"."application_decision" ADD VALUE 'checked_in';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_check_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Checked-in hackers already RSVPed. Meals, Discord, and the wallet QR keep
-- treating them as confirmed, matching hasRsvped() in lib/decisions.ts.
-- Compared as text so this can run in the same transaction as ADD VALUE,
-- which cannot be used as an enum literal until that transaction commits.
CREATE OR REPLACE FUNCTION "public"."has_confirmed_rsvp"("hacker_id" uuid) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hacker_rsvps r
    JOIN public.hacker_applicants a ON a.user_id = r.user_id
    WHERE r.user_id = hacker_id
      AND (
        a.decision::text LIKE '%\_rsvped'
        OR a.decision::text = 'checked_in'
      )
  );
$$;--> statement-breakpoint
-- Same set as RSVP_ELIGIBLE_DECISIONS: accepted, RSVPed, or checked in.
CREATE OR REPLACE FUNCTION "public"."has_accepted_reservation_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hacker_applicants
    WHERE user_id = (SELECT auth.uid())
      AND decision::text IN (
        'early_accepted',
        'early_rsvped',
        'regular_accepted',
        'regular_rsvped',
        'checked_in'
      )
  );
$$;