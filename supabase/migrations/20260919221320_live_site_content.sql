CREATE TYPE "public"."live_announcement_tone" AS ENUM('info', 'important', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."live_content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."live_event_resource_kind" AS ENUM('devpost', 'workshop', 'slides', 'registration', 'resource');--> statement-breakpoint
CREATE TABLE "live_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tone" "live_announcement_tone" DEFAULT 'info' NOT NULL,
	"status" "live_content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_announcements_expiry_after_publish_check" CHECK ("live_announcements"."expires_at" is null or "live_announcements"."published_at" is null or "live_announcements"."expires_at" > "live_announcements"."published_at"),
	CONSTRAINT "live_announcements_position_nonnegative_check" CHECK ("live_announcements"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "live_announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_event_details" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location_details" text DEFAULT '' NOT NULL,
	"map_url" text,
	"event_type" text DEFAULT 'Event' NOT NULL,
	"host_name" text,
	"audience" text,
	"capacity" integer,
	"featured" boolean DEFAULT false NOT NULL,
	"status" "live_content_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_event_details_position_nonnegative_check" CHECK ("live_event_details"."position" >= 0),
	CONSTRAINT "live_event_details_capacity_positive_check" CHECK ("live_event_details"."capacity" is null or "live_event_details"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "live_event_details" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_event_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" "live_event_resource_kind" DEFAULT 'resource' NOT NULL,
	"label" text NOT NULL,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_event_resources_position_nonnegative_check" CHECK ("live_event_resources"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "live_event_resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_guide_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"status" "live_content_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_guide_links_position_nonnegative_check" CHECK ("live_guide_links"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "live_guide_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sponsor" text,
	"value" text,
	"eligibility" text DEFAULT '' NOT NULL,
	"judging_criteria" text DEFAULT '' NOT NULL,
	"url" text,
	"status" "live_content_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_prizes_position_nonnegative_check" CHECK ("live_prizes"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "live_prizes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_site_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"event_name" text DEFAULT 'MHacks Live' NOT NULL,
	"hero_title" text DEFAULT 'Timeline' NOT NULL,
	"hero_description" text DEFAULT 'Events, workshops, food, and deadlines for the weekend.' NOT NULL,
	"timezone" text DEFAULT 'America/Detroit' NOT NULL,
	"devpost_url" text,
	"guide_empty_title" text DEFAULT 'Hacker guide coming soon' NOT NULL,
	"guide_empty_description" text DEFAULT 'Travel details, venue information, policies, and weekend resources are being assembled here.' NOT NULL,
	"prizes_empty_title" text DEFAULT 'Prize details coming soon' NOT NULL,
	"prizes_empty_description" text DEFAULT 'Track descriptions, eligibility details, and judging criteria will appear here once they are finalized.' NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_site_settings_singleton_check" CHECK ("live_site_settings"."id" = 'default')
);
--> statement-breakpoint
ALTER TABLE "live_site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "live_announcements" ADD CONSTRAINT "live_announcements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_announcements" ADD CONSTRAINT "live_announcements_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_event_details" ADD CONSTRAINT "live_event_details_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_event_details" ADD CONSTRAINT "live_event_details_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_event_details" ADD CONSTRAINT "live_event_details_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_event_resources" ADD CONSTRAINT "live_event_resources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_guide_links" ADD CONSTRAINT "live_guide_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_guide_links" ADD CONSTRAINT "live_guide_links_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_prizes" ADD CONSTRAINT "live_prizes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_prizes" ADD CONSTRAINT "live_prizes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_site_settings" ADD CONSTRAINT "live_site_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_announcements_public_feed_idx" ON "live_announcements" USING btree ("status","published_at","position");--> statement-breakpoint
CREATE INDEX "live_event_details_public_order_idx" ON "live_event_details" USING btree ("status","position");--> statement-breakpoint
CREATE INDEX "live_event_resources_event_position_idx" ON "live_event_resources" USING btree ("event_id","position");--> statement-breakpoint
CREATE INDEX "live_guide_links_public_order_idx" ON "live_guide_links" USING btree ("status","position");--> statement-breakpoint
CREATE INDEX "live_prizes_public_order_idx" ON "live_prizes" USING btree ("status","position");--> statement-breakpoint
CREATE POLICY "events_select_published_live" ON "events" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (
        select 1 from public.live_event_details
        where live_event_details.event_id = "events"."id"
          and live_event_details.status = 'published'
      ));--> statement-breakpoint
CREATE POLICY "live_announcements_public_select" ON "live_announcements" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("live_announcements"."status" = 'published'
        and ("live_announcements"."published_at" is null or "live_announcements"."published_at" <= now())
        and ("live_announcements"."expires_at" is null or "live_announcements"."expires_at" > now()));--> statement-breakpoint
CREATE POLICY "live_announcements_organizer_all" ON "live_announcements" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "live_event_details_public_select" ON "live_event_details" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("live_event_details"."status" = 'published');--> statement-breakpoint
CREATE POLICY "live_event_details_organizer_all" ON "live_event_details" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "live_event_resources_public_select" ON "live_event_resources" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (
        select 1 from public.live_event_details
        where live_event_details.event_id = "live_event_resources"."event_id"
          and live_event_details.status = 'published'
      ));--> statement-breakpoint
CREATE POLICY "live_event_resources_organizer_all" ON "live_event_resources" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "live_guide_links_public_select" ON "live_guide_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("live_guide_links"."status" = 'published');--> statement-breakpoint
CREATE POLICY "live_guide_links_organizer_all" ON "live_guide_links" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "live_prizes_public_select" ON "live_prizes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("live_prizes"."status" = 'published');--> statement-breakpoint
CREATE POLICY "live_prizes_organizer_all" ON "live_prizes" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "live_site_settings_public_select" ON "live_site_settings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "live_site_settings_organizer_all" ON "live_site_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));