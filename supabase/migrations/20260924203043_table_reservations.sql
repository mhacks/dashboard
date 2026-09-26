CREATE TYPE "public"."reservation_event_status" AS ENUM('draft', 'open', 'closed', 'archived');--> statement-breakpoint
CREATE TABLE "reservation_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"event_name" text NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservation_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "table_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone,
	"location" text,
	"status" "reservation_event_status" DEFAULT 'draft' NOT NULL,
	"reservations_open_at" timestamp with time zone,
	"reservations_close_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_reservation_window_valid" CHECK ("table_reservations"."reservations_open_at" IS NULL
        OR "table_reservations"."reservations_close_at" IS NULL
        OR "table_reservations"."reservations_close_at" > "table_reservations"."reservations_open_at")
);
--> statement-breakpoint
ALTER TABLE "table_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"reserved_by_team_id" uuid,
	"reserved_at" timestamp with time zone,
	CONSTRAINT "tables_event_number_unique" UNIQUE("event_id","number"),
	CONSTRAINT "tables_number_positive" CHECK ("tables"."number" > 0),
	CONSTRAINT "tables_reservation_timestamp_consistent" CHECK (("tables"."reserved_by_team_id" IS NULL) =
        ("tables"."reserved_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reservation_audit_log" ADD CONSTRAINT "reservation_audit_log_event_id_table_reservations_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."table_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_audit_log" ADD CONSTRAINT "reservation_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_event_id_table_reservations_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."table_reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_reserved_by_team_id_teams_id_fk" FOREIGN KEY ("reserved_by_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservation_audit_event_created_at_idx" ON "reservation_audit_log" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "reservation_audit_created_at_idx" ON "reservation_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "table_reservations_status_starts_at_idx" ON "table_reservations" USING btree ("status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_event_team_unique" ON "tables" USING btree ("event_id","reserved_by_team_id");--> statement-breakpoint
CREATE POLICY "reservation_audit_select_organizer" ON "reservation_audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "table_reservations_select_visible_or_organizer" ON "table_reservations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()) OR "table_reservations"."status" IN ('open', 'closed'));--> statement-breakpoint
CREATE POLICY "tables_select_visible_or_organizer" ON "tables" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()) OR EXISTS (
        SELECT 1 FROM public.table_reservations
        WHERE id = "tables"."event_id"
          AND status IN ('open', 'closed')
      ));