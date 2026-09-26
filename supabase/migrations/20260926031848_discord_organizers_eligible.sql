-- Organizers can verify through the MHacks Discord bot too, and get the Hacker
-- Discord role (the bot maps organizer -> Hacker). No RSVP is required: they
-- never apply. Same signatures and return types as 20260925202204_discord_rpcs.sql,
-- so CREATE OR REPLACE keeps the service_role-only grants from that migration,
-- and discord_verify_code picks the new rule up through discord_lookup_member.
CREATE OR REPLACE FUNCTION "public"."discord_lookup_member"("p_email" text)
    RETURNS TABLE (
      "user_id" uuid,
      "role" "public"."user_role",
      "full_name" text,
      "eligible" boolean,
      "linked_discord_id" text
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT
    u.id,
    u.role,
    nullif(trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), ''),
    (u.role = 'hacker' AND public.has_confirmed_rsvp(u.id)) OR u.role IN ('volunteer', 'organizer'),
    d.discord_user_id
  FROM public.users u
  LEFT JOIN public.hacker_applicants a ON a.user_id = u.id
  LEFT JOIN public.discord_accounts d ON d.user_id = u.id
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."discord_lookup_by_discord_id"("p_discord_id" text)
    RETURNS TABLE (
      "user_id" uuid,
      "role" "public"."user_role",
      "full_name" text,
      "eligible" boolean,
      "linked_discord_id" text
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT
    u.id,
    u.role,
    nullif(trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), ''),
    (u.role = 'hacker' AND public.has_confirmed_rsvp(u.id)) OR u.role IN ('volunteer', 'organizer'),
    d.discord_user_id
  FROM public.discord_accounts d
  JOIN public.users u ON u.id = d.user_id
  LEFT JOIN public.hacker_applicants a ON a.user_id = u.id
  WHERE d.discord_user_id = p_discord_id;
$$;
