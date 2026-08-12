CREATE TYPE "public"."rsvp_travel_plan" AS ENUM('umich-student', 'self-funded', 'reimbursement');--> statement-breakpoint
CREATE TYPE "public"."rsvp_tshirt_size" AS ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL');--> statement-breakpoint
CREATE TABLE "hacker_rsvp_drafts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_version" integer DEFAULT 0 NOT NULL,
	"receipt_key" text,
	"receipt_original_name" text,
	"receipt_content_type" text,
	"receipt_size_bytes" integer,
	"receipt_version" integer DEFAULT 0 NOT NULL,
	"pending_receipt_upload_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_rsvp_drafts_receipt_metadata_complete" CHECK ((
        "hacker_rsvp_drafts"."receipt_key" IS NULL
        AND "hacker_rsvp_drafts"."receipt_original_name" IS NULL
        AND "hacker_rsvp_drafts"."receipt_content_type" IS NULL
        AND "hacker_rsvp_drafts"."receipt_size_bytes" IS NULL
      ) OR (
        "hacker_rsvp_drafts"."receipt_key" IS NOT NULL
        AND "hacker_rsvp_drafts"."receipt_original_name" IS NOT NULL
        AND "hacker_rsvp_drafts"."receipt_content_type" IS NOT NULL
        AND "hacker_rsvp_drafts"."receipt_content_type" IN ('application/pdf', 'image/png', 'image/jpeg')
        AND "hacker_rsvp_drafts"."receipt_size_bytes" IS NOT NULL
        AND "hacker_rsvp_drafts"."receipt_size_bytes" BETWEEN 1 AND 10485760
      )),
	CONSTRAINT "hacker_rsvp_drafts_versions_nonnegative" CHECK ("hacker_rsvp_drafts"."data_version" >= 0 AND "hacker_rsvp_drafts"."receipt_version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hacker_rsvp_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hacker_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"preferred_name" text NOT NULL,
	"email" text NOT NULL,
	"email_matches_application" boolean NOT NULL,
	"incorrect_email_risk_acknowledged" boolean NOT NULL,
	"dietary_restrictions" text[] NOT NULL,
	"other_dietary_restriction" text,
	"tshirt_size" "rsvp_tshirt_size" NOT NULL,
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
	"state_or_province" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text NOT NULL,
	"activities_waiver_response" boolean NOT NULL,
	"photo_release_response" boolean NOT NULL,
	"additional_notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_rsvps_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "hacker_rsvps_application_id_unique" UNIQUE("application_id"),
	CONSTRAINT "hacker_rsvps_email_acknowledgements" CHECK ("hacker_rsvps"."email_matches_application" IS TRUE AND "hacker_rsvps"."incorrect_email_risk_acknowledged" IS TRUE),
	CONSTRAINT "hacker_rsvps_dietary_values" CHECK (cardinality("hacker_rsvps"."dietary_restrictions") > 0
        AND "hacker_rsvps"."dietary_restrictions" <@ ARRAY[
          'vegetarian', 'vegan', 'kosher', 'halal', 'gluten-free', 'nut-free', 'dairy-free', 'none', 'other'
        ]::text[]),
	CONSTRAINT "hacker_rsvps_dietary_none_exclusive" CHECK (NOT (
        'none' = ANY("hacker_rsvps"."dietary_restrictions")
        AND cardinality("hacker_rsvps"."dietary_restrictions") > 1
      )),
	CONSTRAINT "hacker_rsvps_dietary_other_consistent" CHECK ((
        'other' = ANY("hacker_rsvps"."dietary_restrictions")
        AND NULLIF(BTRIM("hacker_rsvps"."other_dietary_restriction"), '') IS NOT NULL
      ) OR (
        NOT ('other' = ANY("hacker_rsvps"."dietary_restrictions"))
        AND "hacker_rsvps"."other_dietary_restriction" IS NULL
      )),
	CONSTRAINT "hacker_rsvps_reimbursement_consistent" CHECK ((
        "hacker_rsvps"."travel_plan" = 'reimbursement'
        AND "hacker_rsvps"."travel_guide_acknowledged" IS TRUE
        AND "hacker_rsvps"."flight_booked" IS TRUE
        AND "hacker_rsvps"."receipt_binding_acknowledged" IS TRUE
        AND "hacker_rsvps"."receipt_key" IS NOT NULL
        AND "hacker_rsvps"."receipt_original_name" IS NOT NULL
        AND "hacker_rsvps"."receipt_content_type" IS NOT NULL
        AND "hacker_rsvps"."receipt_content_type" IN ('application/pdf', 'image/png', 'image/jpeg')
        AND "hacker_rsvps"."receipt_size_bytes" IS NOT NULL
        AND "hacker_rsvps"."receipt_size_bytes" BETWEEN 1 AND 10485760
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
CREATE TABLE "rsvp_receipt_cleanup" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	CONSTRAINT "rsvp_receipt_cleanup_attempts_nonnegative" CHECK ("rsvp_receipt_cleanup"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rsvp_receipt_cleanup" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_rsvp_drafts" ADD CONSTRAINT "hacker_rsvp_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_rsvps" ADD CONSTRAINT "hacker_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_rsvps" ADD CONSTRAINT "hacker_rsvps_application_id_hacker_applicants_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_receipt_cleanup" ADD CONSTRAINT "rsvp_receipt_cleanup_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rsvp_receipt_cleanup_user_id_created_at_idx" ON "rsvp_receipt_cleanup" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE POLICY "hacker_rsvp_drafts_select_own" ON "hacker_rsvp_drafts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_rsvp_drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "hacker_rsvps_select_own_or_organizer" ON "hacker_rsvps" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_rsvps"."user_id" = (select auth.uid()) OR exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "hacker_rsvp_drafts" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "hacker_rsvps" FROM "anon", "authenticated";--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "rsvp_receipt_cleanup" FROM "anon", "authenticated";
