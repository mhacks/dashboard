CREATE TYPE "public"."email_preference_source" AS ENUM('send', 'one_click', 'footer', 'account');--> statement-breakpoint
CREATE TYPE "public"."email_preference_status" AS ENUM('subscribed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"topic" text DEFAULT 'event-updates' NOT NULL,
	"status" "email_preference_status" DEFAULT 'subscribed' NOT NULL,
	"source" "email_preference_source" DEFAULT 'send' NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "suppressed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_preferences_email_topic_unique" ON "email_preferences" USING btree (lower("email"),"topic");--> statement-breakpoint
CREATE INDEX "email_preferences_user_topic_idx" ON "email_preferences" USING btree ("user_id","topic");--> statement-breakpoint
CREATE POLICY "email_preferences_own_or_organizer_select" ON "email_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("email_preferences"."user_id" = (select auth.uid()) OR (select public.is_organizer()));