ALTER TABLE "hacker_applicants" DROP CONSTRAINT "hacker_applicants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "judge_applicants" DROP CONSTRAINT "judge_applicants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "review_motivation" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "review_builder_mindset" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "review_collaboration" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "review_creativity" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "review_diversity" integer;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "flag_for_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "review_notes" text;