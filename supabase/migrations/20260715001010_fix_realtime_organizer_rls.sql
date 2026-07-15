ALTER POLICY "organizers_receive_review_realtime" ON "realtime"."messages" TO authenticated USING (public.is_organizer() AND (
  realtime.topic() = 'application-review:dashboard'
  OR realtime.topic() LIKE 'application-review:%'
));--> statement-breakpoint
ALTER POLICY "organizers_send_review_realtime" ON "realtime"."messages" TO authenticated WITH CHECK (public.is_organizer() AND (
  realtime.topic() = 'application-review:dashboard'
  OR realtime.topic() LIKE 'application-review:%'
));