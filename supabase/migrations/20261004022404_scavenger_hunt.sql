CREATE TABLE "hunt_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_by" uuid,
	"redeemed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hunt_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hunt_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"code_id" uuid,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flower" text,
	"petal_misses" integer DEFAULT 0 NOT NULL,
	"petal_locked_until" timestamp with time zone,
	"petal_code" text,
	"petal_found_at" timestamp with time zone,
	CONSTRAINT "hunt_progress_petal_code_unique" UNIQUE("petal_code")
);
--> statement-breakpoint
ALTER TABLE "hunt_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hunt_codes" ADD CONSTRAINT "hunt_codes_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_codes" ADD CONSTRAINT "hunt_codes_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD CONSTRAINT "hunt_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD CONSTRAINT "hunt_progress_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "public"."hunt_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hunt_codes_open_code_key" ON "hunt_codes" USING btree ("code") WHERE "hunt_codes"."redeemed_by" is null;--> statement-breakpoint
CREATE INDEX "hunt_codes_organizer_created_idx" ON "hunt_codes" USING btree ("organizer_id","created_at");--> statement-breakpoint
CREATE POLICY "hunt_codes_organizer_select" ON "hunt_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "hunt_progress_select_own_or_organizer" ON "hunt_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hunt_progress"."user_id" = (select auth.uid()) OR (select public.is_organizer()));