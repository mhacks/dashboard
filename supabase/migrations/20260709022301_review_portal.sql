CREATE TYPE "public"."review_event_type" AS ENUM('draft_saved', 'review_completed');--> statement-breakpoint
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
ALTER TABLE "hacker_application_reviews" ADD CONSTRAINT "hacker_application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_reviews" ADD CONSTRAINT "hacker_application_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."hacker_application_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."hacker_applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_application_review_events" ADD CONSTRAINT "hacker_application_review_events_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hacker_application_review_events_application_id_created_at_idx" ON "hacker_application_review_events" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE TRIGGER "hacker_application_reviews_set_updated_at" BEFORE UPDATE ON "public"."hacker_application_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
