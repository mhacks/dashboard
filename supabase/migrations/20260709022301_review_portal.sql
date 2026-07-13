CREATE TYPE "public"."application_status" AS ENUM('pending', 'reviewed', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."review_event_type" AS ENUM('draft_saved', 'review_completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('hacker', 'organizer');--> statement-breakpoint
CREATE TABLE "hacker_applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"phone_number" text DEFAULT '' NOT NULL,
	"age" integer NOT NULL,
	"gender" text NOT NULL,
	"ethnicity" text NOT NULL,
	"university" text NOT NULL,
	"country" text NOT NULL,
	"degree" text NOT NULL,
	"graduation_year" integer NOT NULL,
	"previous_hackathons" integer NOT NULL,
	"major" text NOT NULL,
	"resume" text,
	"what_would_you_do" text NOT NULL,
	"why_mhacks" text NOT NULL,
	"hill_to_die_on" text NOT NULL,
	"anything_else" text,
	"transportation_type" text NOT NULL,
	"coming_from" text NOT NULL,
	"shirt_size" text NOT NULL,
	"allergies_description" text,
	"needs_travel_reimbursement" boolean NOT NULL,
	"would_attend_without_reimbursement" boolean,
	"airport_code" text,
	"github" text,
	"linkedin" text,
	"personal_site" text,
	"follows_instagram" boolean,
	"sponsor_emails" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_applicants_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "hacker_applicants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hacker_application_drafts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hacker_application_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hacker_application_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"effort_rating" integer,
	"builder_rating" integer,
	"flagged_for_review" boolean DEFAULT false NOT NULL,
	"review_comments" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_application_reviews_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hacker_application_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"event_type" "review_event_type" NOT NULL,
	"changes" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'hacker' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD CONSTRAINT "hacker_applicants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_drafts" ADD CONSTRAINT "hacker_application_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ADD CONSTRAINT "hacker_application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ADD CONSTRAINT "hacker_application_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."hacker_application_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hacker_application_review_events_application_id_created_at_idx" ON "hacker_application_review_events" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new."updated_at" = now();
  return new;
end;
$$;
--> statement-breakpoint
CREATE TRIGGER "hacker_applicants_set_updated_at" BEFORE UPDATE ON "public"."hacker_applicants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "hacker_application_reviews_set_updated_at" BEFORE UPDATE ON "public"."hacker_application_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
--> statement-breakpoint
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "handle_new_user"();
