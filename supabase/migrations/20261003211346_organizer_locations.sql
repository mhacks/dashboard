CREATE TABLE "organizer_location_sharing" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_location_sharing_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "organizer_location_sharing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizer_locations" (
	"user_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" integer,
	"battery" smallint,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_locations_pkey" PRIMARY KEY("user_id","recorded_at")
);
--> statement-breakpoint
ALTER TABLE "organizer_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizer_location_sharing" ADD CONSTRAINT "organizer_location_sharing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_locations" ADD CONSTRAINT "organizer_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."organizer_location_sharing"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizer_locations_recorded_at_idx" ON "organizer_locations" USING btree ("recorded_at");--> statement-breakpoint
CREATE POLICY "organizer_location_sharing_organizer_select" ON "organizer_location_sharing" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "organizer_locations_organizer_select" ON "organizer_locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));