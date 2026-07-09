CREATE TYPE "public"."review_event_type" AS ENUM('draft_saved', 'review_completed');--> statement-breakpoint
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
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."hacker_application_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;