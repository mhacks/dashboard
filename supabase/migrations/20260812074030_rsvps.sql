CREATE TYPE "public"."rsvp_travel_plan" AS ENUM('local', 'self-funded', 'reimbursement');--> statement-breakpoint
CREATE TABLE "hacker_rsvp_drafts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hacker_rsvp_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hacker_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"travel_plan" "rsvp_travel_plan" NOT NULL,
	"travel_guide_acknowledged" boolean,
	"flight_booked" boolean,
	"receipt_key" text,
	"receipt_original_name" text,
	"receipt_content_type" text,
	"receipt_size_bytes" integer,
	"receipt_binding_acknowledged" boolean,
	"street_address" text NOT NULL,
	"city" text NOT NULL,
	"state_or_province" text,
	"postal_code" text,
	"country" text NOT NULL,
	"activities_waiver_response" boolean NOT NULL,
	"photo_release_response" boolean NOT NULL,
	"additional_notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_rsvps_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "hacker_rsvps_application_id_unique" UNIQUE("application_id"),
	CONSTRAINT "hacker_rsvps_reimbursement_consistent" CHECK ((
        "hacker_rsvps"."travel_plan" = 'reimbursement'
        AND "hacker_rsvps"."travel_guide_acknowledged" IS TRUE
        AND "hacker_rsvps"."flight_booked" IS TRUE
        AND "hacker_rsvps"."receipt_binding_acknowledged" IS TRUE
        AND "hacker_rsvps"."receipt_key" IS NOT NULL
        AND "hacker_rsvps"."receipt_original_name" IS NOT NULL
        AND "hacker_rsvps"."receipt_content_type" IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
        AND "hacker_rsvps"."receipt_size_bytes" IS NOT NULL
        AND "hacker_rsvps"."receipt_size_bytes" BETWEEN 1 AND 20971520
      ) OR (
        "hacker_rsvps"."travel_plan" <> 'reimbursement'
        AND "hacker_rsvps"."travel_guide_acknowledged" IS NULL
        AND "hacker_rsvps"."flight_booked" IS NULL
        AND "hacker_rsvps"."receipt_binding_acknowledged" IS NULL
        AND "hacker_rsvps"."receipt_key" IS NULL
        AND "hacker_rsvps"."receipt_original_name" IS NULL
        AND "hacker_rsvps"."receipt_content_type" IS NULL
        AND "hacker_rsvps"."receipt_size_bytes" IS NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "hacker_rsvps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_rsvp_drafts" ADD CONSTRAINT "hacker_rsvp_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_rsvps" ADD CONSTRAINT "hacker_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_rsvps" ADD CONSTRAINT "hacker_rsvps_application_id_hacker_applicants_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "hacker_rsvp_drafts_select_own" ON "hacker_rsvp_drafts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_rsvp_drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "hacker_rsvps_select_own_or_organizer" ON "hacker_rsvps" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_rsvps"."user_id" = (select auth.uid()) OR exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "hacker_rsvp_drafts" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "hacker_rsvps" FROM "anon", "authenticated";
