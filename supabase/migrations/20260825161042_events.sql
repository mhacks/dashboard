CREATE TYPE "public"."checkin_method" AS ENUM('scan', 'manual');--> statement-breakpoint
CREATE TYPE "public"."event_scan_outcome" AS ENUM('checked_in', 'already_checked_in', 'unknown_code', 'not_accepted', 'no_rsvp', 'event_closed', 'reverted');--> statement-breakpoint
CREATE TABLE "event_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by" uuid,
	"method" "checkin_method" DEFAULT 'scan' NOT NULL,
	CONSTRAINT "event_checkins_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_scan_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid,
	"scanned_by" uuid,
	"outcome" "event_scan_outcome" NOT NULL,
	"client_scan_id" uuid,
	"raw_code" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_scan_log_client_scan_id_unique" UNIQUE("client_scan_id")
);
--> statement-breakpoint
ALTER TABLE "event_scan_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_scan_log" ADD CONSTRAINT "event_scan_log_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_checkins_event_time_idx" ON "event_checkins" USING btree ("event_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "event_scan_log_event_time_idx" ON "event_scan_log" USING btree ("event_id","scanned_at");--> statement-breakpoint
CREATE POLICY "event_checkins_select_own_or_staff" ON "event_checkins" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event_checkins"."user_id" = (select auth.uid()) OR exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role in ('organizer', 'volunteer')
));--> statement-breakpoint
CREATE POLICY "event_checkins_insert_staff" ON "event_checkins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role in ('organizer', 'volunteer')
));--> statement-breakpoint
CREATE POLICY "event_checkins_delete_organizer" ON "event_checkins" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "event_scan_log_select_staff" ON "event_scan_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role in ('organizer', 'volunteer')
));--> statement-breakpoint
CREATE POLICY "event_scan_log_insert_staff" ON "event_scan_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role in ('organizer', 'volunteer')
));--> statement-breakpoint
CREATE POLICY "events_select_staff" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role in ('organizer', 'volunteer')
));--> statement-breakpoint
CREATE POLICY "events_insert_organizer" ON "events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "events_update_organizer" ON "events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
)) WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "events_delete_organizer" ON "events" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));