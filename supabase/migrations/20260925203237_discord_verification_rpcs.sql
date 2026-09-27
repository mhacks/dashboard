-- Email-code verification for the MHacks Discord bot. The bot generates the
-- code, emails it, and only ever hands Postgres its SHA-256, so the plaintext
-- never lands in the database. Grants follow 20260925202204_discord_rpcs.sql:
-- service_role only, explicitly revoked from anon and authenticated.

-- Belt and braces on top of RLS-with-no-policies: nobody but the owner and
-- service_role touches these tables directly.
REVOKE ALL PRIVILEGES ON TABLE "discord_verification_codes" FROM "anon", "authenticated";
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "discord_verification_sends" FROM "anon", "authenticated";
--> statement-breakpoint
-- Records a new code for a Discord account, replacing any earlier one, unless
-- that account or that inbox has hit its hourly send limit. Returns 'ok' or
-- 'rate_limited'. The per-inbox limit stops the bot being used to flood
-- someone else's email from many Discord accounts.
--
-- Advisory locks serialise concurrent calls for the same account and inbox so
-- two clicks can't both pass the count. Always taken account-then-inbox, so
-- they can't deadlock.
CREATE OR REPLACE FUNCTION "public"."discord_issue_code"(
      "p_discord_id" text,
      "p_user_id" uuid,
      "p_email" text,
      "p_code_hash" text,
      "p_ttl_seconds" integer DEFAULT 600,
      "p_max_per_user" integer DEFAULT 3,
      "p_max_per_email" integer DEFAULT 5
    ) RETURNS text
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('discord_issue_user:' || p_discord_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('discord_issue_email:' || v_email, 0));

  IF (SELECT count(*) FROM public.discord_verification_sends s
      WHERE s.discord_user_id = p_discord_id
        AND s.sent_at > now() - interval '1 hour') >= p_max_per_user
  OR (SELECT count(*) FROM public.discord_verification_sends s
      WHERE s.email = v_email
        AND s.sent_at > now() - interval '1 hour') >= p_max_per_email
  THEN
    RETURN 'rate_limited';
  END IF;

  DELETE FROM public.discord_verification_sends s
  WHERE s.sent_at < now() - interval '1 day';

  INSERT INTO public.discord_verification_sends (discord_user_id, email)
  VALUES (p_discord_id, v_email);

  INSERT INTO public.discord_verification_codes
    (discord_user_id, user_id, email, code_hash, attempts, expires_at)
  VALUES
    (p_discord_id, p_user_id, v_email, p_code_hash, 0,
     now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (discord_user_id) DO UPDATE
    SET user_id = excluded.user_id,
        email = excluded.email,
        code_hash = excluded.code_hash,
        attempts = 0,
        expires_at = excluded.expires_at,
        created_at = now();

  RETURN 'ok';
END;
$$;
--> statement-breakpoint
-- Checks a code and, if it matches, links the Discord account in the same
-- transaction. status is one of:
--   ok              linked; user_id, role and full_name are set
--   wrong           attempts_left more tries remain
--   locked          out of attempts; the member must request a new code
--   expired / none  no live code for this Discord account
--   ineligible      the code was right but the member no longer qualifies
--                   (e.g. RSVP withdrawn since the code was sent)
--   already_linked  the code was right but this Discord account or this MHacks
--                   account is already linked to a different one
-- The row is locked FOR UPDATE, so parallel guesses queue up behind each other
-- and can't overrun the attempt limit. A matching code is deleted before
-- anything else, so it is single use even when linking is then refused.
CREATE OR REPLACE FUNCTION "public"."discord_verify_code"(
      "p_discord_id" text,
      "p_code_hash" text,
      "p_username" text,
      "p_max_attempts" integer DEFAULT 5
    ) RETURNS TABLE (
      "status" text,
      "user_id" uuid,
      "role" "public"."user_role",
      "full_name" text,
      "attempts_left" integer
    )
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
#variable_conflict use_column
DECLARE
  v_code public.discord_verification_codes%ROWTYPE;
  v_member record;
BEGIN
  SELECT * INTO v_code
  FROM public.discord_verification_codes c
  WHERE c.discord_user_id = p_discord_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'none'::text, NULL::uuid, NULL::public.user_role, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_code.expires_at <= now() THEN
    DELETE FROM public.discord_verification_codes c WHERE c.discord_user_id = p_discord_id;
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::public.user_role, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_code.attempts >= p_max_attempts THEN
    RETURN QUERY SELECT 'locked'::text, NULL::uuid, NULL::public.user_role, NULL::text, 0;
    RETURN;
  END IF;

  IF v_code.code_hash <> p_code_hash THEN
    UPDATE public.discord_verification_codes c
    SET attempts = c.attempts + 1
    WHERE c.discord_user_id = p_discord_id;
    IF v_code.attempts + 1 >= p_max_attempts THEN
      RETURN QUERY SELECT 'locked'::text, NULL::uuid, NULL::public.user_role, NULL::text, 0;
    ELSE
      RETURN QUERY SELECT 'wrong'::text, NULL::uuid, NULL::public.user_role, NULL::text,
        p_max_attempts - v_code.attempts - 1;
    END IF;
    RETURN;
  END IF;

  DELETE FROM public.discord_verification_codes c WHERE c.discord_user_id = p_discord_id;

  SELECT * INTO v_member FROM public.discord_lookup_member(v_code.email) m;
  IF NOT FOUND OR NOT v_member.eligible OR v_member.user_id <> v_code.user_id THEN
    RETURN QUERY SELECT 'ineligible'::text, NULL::uuid, NULL::public.user_role, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_member.linked_discord_id IS NOT NULL AND v_member.linked_discord_id <> p_discord_id THEN
    RETURN QUERY SELECT 'already_linked'::text, NULL::uuid, NULL::public.user_role, NULL::text, NULL::integer;
    RETURN;
  END IF;

  BEGIN
    PERFORM public.link_discord_account(v_code.user_id, p_discord_id, p_username);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'discord_account_already_linked' THEN
      RETURN QUERY SELECT 'already_linked'::text, NULL::uuid, NULL::public.user_role, NULL::text, NULL::integer;
      RETURN;
    END IF;
    RAISE;
  END;

  RETURN QUERY SELECT 'ok'::text, v_member.user_id, v_member.role, v_member.full_name, NULL::integer;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."discord_issue_code"(text, uuid, text, text, integer, integer, integer) FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."discord_verify_code"(text, text, text, integer) FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."discord_issue_code"(text, uuid, text, text, integer, integer, integer) TO "service_role";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."discord_verify_code"(text, text, text, integer) TO "service_role";
