-- Reimbursement awards are binary. An award row exists only for a hacker who
-- is getting travel reimbursement, so there is nothing to leave undecided:
--   approved -- the hacker is eligible for reimbursement after the hackathon.
--   denied   -- the hacker is not.
--
-- Rows still on the old 'pending' value are awards that were granted but never
-- finalized, so they land on 'approved', matching the new column default.
--
-- Postgres cannot remove a value from an enum in place, so the type is rebuilt
-- under a temporary name and the column moved across. The old type is kept
-- until the column no longer references it.
UPDATE "hacker_reimbursements" SET "status" = 'approved' WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."reimbursement_status" RENAME TO "reimbursement_status_old";--> statement-breakpoint
CREATE TYPE "public"."reimbursement_status" AS ENUM('approved', 'denied');--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ALTER COLUMN "status" SET DATA TYPE "public"."reimbursement_status" USING "status"::text::"public"."reimbursement_status";--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ALTER COLUMN "status" SET DEFAULT 'approved';--> statement-breakpoint
DROP TYPE "public"."reimbursement_status_old";--> statement-breakpoint
COMMENT ON COLUMN "hacker_reimbursements"."status" IS 'approved: the hacker is eligible for reimbursement after the hackathon. denied: they are not.';
