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
--> statement-breakpoint
ALTER POLICY "organizers_receive_review_realtime" ON "realtime"."messages" TO authenticated USING (public.is_organizer() AND (
  realtime.topic() = 'application-review:dashboard'
  OR realtime.topic() LIKE 'application-review:%'
));--> statement-breakpoint
ALTER POLICY "organizers_send_review_realtime" ON "realtime"."messages" TO authenticated WITH CHECK (public.is_organizer() AND (
  realtime.topic() = 'application-review:dashboard'
  OR realtime.topic() LIKE 'application-review:%'
));--> statement-breakpoint
CREATE TRIGGER "hacker_application_reviews_set_updated_at" BEFORE UPDATE ON "public"."hacker_application_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
