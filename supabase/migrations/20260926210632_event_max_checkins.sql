ALTER TABLE "event_checkins" DROP CONSTRAINT "event_checkins_event_user_unique";--> statement-breakpoint
ALTER TABLE "event_checkins" ADD COLUMN "scan_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "max_checkins" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_event_user_scan_unique" UNIQUE("event_id","user_id","scan_number");--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_scan_number_positive" CHECK ("event_checkins"."scan_number" >= 1);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_max_checkins_positive" CHECK ("events"."max_checkins" >= 1);--> statement-breakpoint
ALTER POLICY "event_checkins_insert_staff" ON "event_checkins" TO authenticated WITH CHECK ((select public.is_event_staff())
  and "event_checkins"."checked_in_by" = (select auth.uid())
  and (
    public.has_confirmed_rsvp("event_checkins"."user_id")
    or exists (
      select 1 from public.events event
      where event.id = "event_checkins"."event_id" and not event.requires_rsvp
    )
  )
  and exists (
    select 1 from public.events event
    where event.id = "event_checkins"."event_id"
      and "event_checkins"."scan_number" <= event.max_checkins
  )
  and public.is_event_open("event_checkins"."event_id"));