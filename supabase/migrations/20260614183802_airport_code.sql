ALTER TABLE "hacker_applicants" DROP CONSTRAINT IF EXISTS "hacker_applicants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "judge_applicants" DROP CONSTRAINT IF EXISTS "judge_applicants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "airport_code" text;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "review_motivation" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "review_builder_mindset" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "review_collaboration" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "review_creativity" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "review_diversity" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "flag_for_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "review_notes" text;--> statement-breakpoint
ALTER TABLE "judge_applicants" ADD COLUMN IF NOT EXISTS "airport_code" text;
