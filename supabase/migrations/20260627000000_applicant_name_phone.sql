ALTER TABLE "hacker_applicants" DROP CONSTRAINT IF EXISTS "hacker_applicants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "judge_applicants" DROP CONSTRAINT IF EXISTS "judge_applicants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN IF NOT EXISTS "phone_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "judge_applicants" ADD COLUMN IF NOT EXISTS "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "judge_applicants" ADD COLUMN IF NOT EXISTS "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "judge_applicants" ADD COLUMN IF NOT EXISTS "phone_number" text DEFAULT '' NOT NULL;
