CREATE TABLE "hunt_decoy_organizers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"added_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hunt_decoy_organizers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hunt_decoy_organizers" ADD CONSTRAINT "hunt_decoy_organizers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_decoy_organizers" ADD CONSTRAINT "hunt_decoy_organizers_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "hunt_decoy_organizers_organizer_all" ON "hunt_decoy_organizers" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));