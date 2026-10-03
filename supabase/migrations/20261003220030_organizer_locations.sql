CREATE TABLE "organizer_locations" (
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" integer,
	"battery" smallint,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_locations_pkey" PRIMARY KEY("name","recorded_at")
);
--> statement-breakpoint
ALTER TABLE "organizer_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "organizer_locations_recorded_at_idx" ON "organizer_locations" USING btree ("recorded_at");--> statement-breakpoint
CREATE POLICY "organizer_locations_organizer_select" ON "organizer_locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));