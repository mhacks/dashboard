CREATE TABLE "reservation_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"reservations_open_at" timestamp with time zone,
	"reservations_close_at" timestamp with time zone,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_settings_singleton_check" CHECK ("reservation_settings"."id" = 'default'),
	CONSTRAINT "reservation_settings_window_valid" CHECK ("reservation_settings"."reservations_open_at" IS NULL
        OR "reservation_settings"."reservations_close_at" IS NULL
        OR "reservation_settings"."reservations_close_at" > "reservation_settings"."reservations_open_at")
);
--> statement-breakpoint
ALTER TABLE "reservation_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "table_reservations_select_visible_or_organizer" ON "table_reservations" CASCADE;--> statement-breakpoint
DROP TABLE "table_reservations" CASCADE;--> statement-breakpoint
ALTER TABLE "tables" DROP CONSTRAINT "tables_event_number_unique";--> statement-breakpoint
DROP INDEX "reservation_audit_event_created_at_idx";--> statement-breakpoint
DROP INDEX "tables_event_team_unique";--> statement-breakpoint
ALTER TABLE "reservation_settings" ADD CONSTRAINT "reservation_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tables_team_unique" ON "tables" USING btree ("reserved_by_team_id");--> statement-breakpoint
ALTER TABLE "reservation_audit_log" DROP COLUMN "event_id";--> statement-breakpoint
ALTER TABLE "reservation_audit_log" DROP COLUMN "event_name";--> statement-breakpoint
ALTER TABLE "tables" DROP COLUMN "event_id";--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_number_unique" UNIQUE("number");--> statement-breakpoint
CREATE POLICY "tables_select_authenticated" ON "tables" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "reservation_settings_authenticated_select" ON "reservation_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "reservation_settings_organizer_all" ON "reservation_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
DROP TYPE "public"."reservation_event_status";