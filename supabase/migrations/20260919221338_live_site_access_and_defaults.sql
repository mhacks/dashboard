-- Grants and triggers are not generated from the Drizzle table schema.
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
