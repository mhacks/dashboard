-- RPCs for the MHacks Discord bot (github.com/mhacks/mhacks-discord-bot).
--
-- The bot calls these through PostgREST as service_role and nothing else. They
-- are SECURITY DEFINER so the bot never needs direct table access, and they are
-- explicitly revoked from anon and authenticated: Supabase's default privileges
-- grant EXECUTE on new public functions to both, so REVOKE ... FROM PUBLIC alone
-- would leave an unauthenticated email -> name lookup open.
--
-- Eligibility mirrors the bot's roles: an RSVP'd hacker (has_confirmed_rsvp)
-- gets the Hacker role, any volunteer gets the Volunteer role, and everyone else
-- is ineligible. full_name is the application name with no email fallback (unlike
-- personNameSql) because the bot sets it as a Discord nickname; volunteers have
-- no application, so theirs is NULL and the bot leaves their nickname alone.
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
    (u.role = 'hacker' AND public.has_confirmed_rsvp(u.id)) OR u.role = 'volunteer',
    d.discord_user_id
  FROM public.users u
  LEFT JOIN public.hacker_applicants a ON a.user_id = u.id
  LEFT JOIN public.discord_accounts d ON d.user_id = u.id
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;
--> statement-breakpoint
-- Same shape, keyed by Discord account. Lets a member who already verified (then
-- left and rejoined, or lost the role) get it back without another email code.
-- eligible is recomputed, so a hacker whose RSVP was withdrawn is not re-roled.
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
    (u.role = 'hacker' AND public.has_confirmed_rsvp(u.id)) OR u.role = 'volunteer',
    d.discord_user_id
  FROM public.discord_accounts d
  JOIN public.users u ON u.id = d.user_id
  LEFT JOIN public.hacker_applicants a ON a.user_id = u.id
  WHERE d.discord_user_id = p_discord_id;
$$;
--> statement-breakpoint
-- Records a verified link. Upserts on user_id so re-verifying refreshes the
-- username; the bot refuses to send a code when the email is already linked to a
-- different Discord account, so the upsert does not silently move links. A
-- Discord account already linked to someone else hits the unique constraint and
-- is re-raised with a message the bot can recognise.
CREATE OR REPLACE FUNCTION "public"."link_discord_account"(
      "p_user_id" uuid,
      "p_discord_id" text,
      "p_username" text
    ) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
  INSERT INTO public.discord_accounts (user_id, discord_user_id, discord_username)
  VALUES (p_user_id, p_discord_id, p_username)
  ON CONFLICT (user_id) DO UPDATE
    SET discord_user_id = excluded.discord_user_id,
        discord_username = excluded.discord_username,
        verified_at = now();
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'discord_account_already_linked'
    USING ERRCODE = 'P0001',
          DETAIL = 'This Discord account is linked to a different MHacks account.';
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."discord_lookup_member"(text) FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."discord_lookup_by_discord_id"(text) FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."link_discord_account"(uuid, text, text) FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."discord_lookup_member"(text) TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."discord_lookup_by_discord_id"(text) TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."link_discord_account"(uuid, text, text) TO "service_role";
