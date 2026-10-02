-- Grants and triggers are not generated from the Drizzle table schema.
-- New public tables are granted to anon by default. Take that back: only a
-- signed-in user may select this row, and only an organizer may write it.
REVOKE ALL ON TABLE "public"."team_settings" FROM "anon";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."team_settings" TO "authenticated";
--> statement-breakpoint
CREATE TRIGGER "team_settings_set_updated_at" BEFORE UPDATE ON "public"."team_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
INSERT INTO "public"."team_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
