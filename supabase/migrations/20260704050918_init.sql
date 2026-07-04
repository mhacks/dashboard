CREATE TYPE "public"."application_status" AS ENUM('pending', 'reviewed', 'flagged');--> statement-breakpoint
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
CREATE TABLE "hacker_application_drafts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'hacker' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD CONSTRAINT "hacker_applicants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_drafts" ADD CONSTRAINT "hacker_application_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;