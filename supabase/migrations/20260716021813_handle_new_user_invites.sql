CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  invited_role public.user_role;
BEGIN
  SELECT ui.role INTO invited_role
  FROM public.user_invitations ui
  WHERE lower(ui.email) = lower(new.email)
    AND ui.accepted_at IS NULL
    AND ui.revoked_at IS NULL
    AND ui.expires_at > now()
  ORDER BY ui.created_at DESC
  LIMIT 1;

  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, COALESCE(invited_role, 'hacker'))
  ON CONFLICT (id) DO NOTHING;

  IF invited_role IS NOT NULL THEN
    UPDATE public.user_invitations
    SET accepted_at = now()
    WHERE lower(email) = lower(new.email)
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now();
  END IF;

  RETURN new;
END;
$$;
