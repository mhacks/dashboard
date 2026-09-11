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
--> statement-breakpoint
GRANT SELECT ON TABLE
  "public"."events",
  "public"."live_announcements",
  "public"."live_event_details",
  "public"."live_event_resources",
  "public"."live_guide_links",
  "public"."live_prizes",
  "public"."live_site_settings"
TO "anon", "authenticated";
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON TABLE
  "public"."live_announcements",
  "public"."live_event_details",
  "public"."live_event_resources",
  "public"."live_guide_links",
  "public"."live_prizes",
  "public"."live_site_settings"
TO "authenticated";
--> statement-breakpoint
CREATE TRIGGER "live_announcements_set_updated_at" BEFORE UPDATE ON "public"."live_announcements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "live_event_details_set_updated_at" BEFORE UPDATE ON "public"."live_event_details" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "live_event_resources_set_updated_at" BEFORE UPDATE ON "public"."live_event_resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "live_guide_links_set_updated_at" BEFORE UPDATE ON "public"."live_guide_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "live_prizes_set_updated_at" BEFORE UPDATE ON "public"."live_prizes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "live_site_settings_set_updated_at" BEFORE UPDATE ON "public"."live_site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
INSERT INTO "public"."live_site_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "public"."events" (
  "id",
  "slug",
  "name",
  "description",
  "location",
  "starts_at",
  "ends_at",
  "is_active"
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'check-in',
    'Check-in Opens',
    'Pick up your badge and get settled before opening ceremony.',
    'Michigan Union',
    '2026-10-03T09:00:00-04:00',
    '2026-10-03T11:00:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'opening-ceremony',
    'Opening Ceremony',
    'Meet the team, hear the rules, and get ready for the weekend.',
    'Rackham Auditorium',
    '2026-10-03T11:30:00-04:00',
    '2026-10-03T12:15:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'hacking-begins',
    'Hacking Begins',
    'Find a table, sync with your team, and start building.',
    'Hack Floor',
    '2026-10-03T12:30:00-04:00',
    NULL,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'rapid-prototyping',
    'Intro to Rapid Prototyping',
    'Turn a rough idea into a product direction your team can demo.',
    'Workshop Room A',
    '2026-10-03T14:00:00-04:00',
    '2026-10-03T14:45:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'dinner',
    'Dinner',
    'Dinner service for hackers, mentors, volunteers, and sponsors.',
    'Dining Hall',
    '2026-10-03T18:30:00-04:00',
    '2026-10-03T20:00:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'midnight-surprise',
    'Midnight Surprise',
    'Take a quick break for snacks and a mini-challenge.',
    'Main Stage',
    '2026-10-04T00:00:00-04:00',
    '2026-10-04T00:30:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'submissions-due',
    'Project Submissions Due',
    'Submit your project, demo link, team, and prize tracks before the deadline.',
    'Devpost',
    '2026-10-04T12:30:00-04:00',
    NULL,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    'expo-and-judging',
    'Expo and Judging',
    'Present your project to judges and explore what other teams built.',
    'Expo Floor',
    '2026-10-04T13:30:00-04:00',
    '2026-10-04T15:30:00-04:00',
    false
  )
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "public"."live_event_details" (
  "event_id",
  "description",
  "location_details",
  "map_url",
  "event_type",
  "host_name",
  "audience",
  "featured",
  "status",
  "position"
)
SELECT
  "events"."id",
  "seed"."description",
  "seed"."location_details",
  "seed"."map_url",
  "seed"."event_type",
  "seed"."host_name",
  "seed"."audience",
  "seed"."featured",
  'published'::"public"."live_content_status",
  "seed"."position"
FROM (
  VALUES
    ('check-in', 'Bring a photo ID and have your registration email ready. Organizers can help with team and registration questions at the check-in desk.', 'Enter through the main State Street doors and follow signs to the check-in desks.', 'https://maps.google.com/?q=Michigan+Union+Ann+Arbor', 'Logistics', 'MHacks Operations', 'All hackers', true, 0),
    ('opening-ceremony', 'The opening program covers venue logistics, judging, prize tracks, safety, and where to get support. Sponsor representatives will also introduce the challenges available to hackers.', 'Doors open 20 minutes before the program. Accessible seating is available through the main lobby.', 'https://maps.google.com/?q=Rackham+Auditorium+Ann+Arbor', 'Main Event', 'MHacks', 'Hackers, mentors, volunteers, and sponsors', true, 10),
    ('hacking-begins', 'Hacking officially begins. Mentors will start circulating shortly afterward, and organizer support remains available at the help desk throughout the event.', 'Table assignments and quiet work areas will be posted at the venue.', NULL, 'Main Event', 'MHacks', 'All hackers', true, 20),
    ('rapid-prototyping', 'This hands-on workshop moves from problem framing through a lightweight prototype. Bring a laptop and an idea, or join a group when the session starts.', 'Arrive a few minutes early for seating and setup.', NULL, 'Workshop', 'MHacks Tech', 'Beginners welcome', false, 30),
    ('dinner', 'Bring your badge when entering the dining area. Dietary labels will be posted with each option, and organizers can help with allergy questions.', 'Food is served in waves; check announcements for any line or service updates.', NULL, 'Food', 'MHacks Logistics', 'Registered attendees', false, 40),
    ('midnight-surprise', 'Step away from your project for a short reset with food and an optional activity. Full details will be announced during the event.', 'Listen for the announcement before midnight.', NULL, 'Activity', 'MHacks Logistics', 'All attendees', false, 50),
    ('submissions-due', 'Open your Devpost submission early enough to verify every team member, track selection, repository link, and demo asset. Late edits may not be available once judging begins.', 'Submission happens online. The help desk can assist with submission issues before the deadline.', NULL, 'Deadline', 'MHacks', 'Competing teams', true, 60),
    ('expo-and-judging', 'Teams should be ready to give a concise project explanation and a working demo. Keep at least one team member near the assigned table throughout the judging window.', 'Table assignments and judging waves will be posted before hacking ends.', NULL, 'Main Event', 'MHacks Judging', 'Hackers, judges, mentors, and sponsors', true, 70)
) AS "seed" (
  "slug",
  "description",
  "location_details",
  "map_url",
  "event_type",
  "host_name",
  "audience",
  "featured",
  "position"
)
JOIN "public"."events" ON "events"."slug" = "seed"."slug"
ON CONFLICT ("event_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "public"."live_event_resources" (
  "event_id",
  "kind",
  "label",
  "url",
  "position"
)
SELECT
  "events"."id",
  "seed"."kind"::"public"."live_event_resource_kind",
  "seed"."label",
  NULL,
  0
FROM (
  VALUES
    ('rapid-prototyping', 'workshop', 'Workshop materials'),
    ('submissions-due', 'devpost', 'Open Devpost')
) AS "seed" ("slug", "kind", "label")
JOIN "public"."events" ON "events"."slug" = "seed"."slug";
--> statement-breakpoint
INSERT INTO "public"."live_announcements" (
  "id",
  "title",
  "body",
  "tone",
  "status",
  "published_at",
  "position"
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'Sample announcement',
  'Important event updates, schedule changes, and attendee reminders will appear here during the hackathon.',
  'info',
  'published',
  NULL,
  0
)
ON CONFLICT ("id") DO NOTHING;
