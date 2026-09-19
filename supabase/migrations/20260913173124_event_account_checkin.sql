ALTER TABLE "events" ADD COLUMN "requires_rsvp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER POLICY "event_checkins_insert_staff" ON "event_checkins" TO authenticated WITH CHECK ((select public.is_event_staff())
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and (
    public.has_confirmed_rsvp("event_checkins"."user_id")
    or exists (
      select 1 from public.events event
      where event.id = "event_checkins"."event_id" and not event.requires_rsvp
    )
  )
  and public.is_event_open("event_checkins"."event_id"));