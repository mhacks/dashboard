CREATE TABLE "live_bouquets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"arrangement" jsonb NOT NULL,
	"maker_name" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_bouquets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "live_bouquets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "live_bouquets" ADD CONSTRAINT "live_bouquets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_bouquets_hidden_idx" ON "live_bouquets" USING btree ("hidden");--> statement-breakpoint
CREATE POLICY "live_bouquets_organizer_all" ON "live_bouquets" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));