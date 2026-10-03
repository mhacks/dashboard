-- Find my organizer drops opt-in sharing: locations are keyed by the OwnTracks
-- username, one row per person. Existing rows are live positions and a 3-hour
-- trail keyed by user, with no name to carry over, so they are cleared first;
-- phones repopulate the table on their next report.
DELETE FROM "organizer_locations";--> statement-breakpoint
ALTER TABLE "organizer_locations" DROP CONSTRAINT "organizer_locations_user_id_fkey";--> statement-breakpoint
ALTER TABLE "organizer_locations" DROP CONSTRAINT "organizer_locations_pkey";--> statement-breakpoint
ALTER TABLE "organizer_locations" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "organizer_locations" ADD COLUMN "name" text PRIMARY KEY NOT NULL;--> statement-breakpoint
DROP TABLE "organizer_location_sharing";
