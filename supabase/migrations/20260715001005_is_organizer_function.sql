CREATE OR REPLACE FUNCTION "public"."is_organizer"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role = 'organizer'
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."is_organizer"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."is_organizer"() TO "authenticated";
