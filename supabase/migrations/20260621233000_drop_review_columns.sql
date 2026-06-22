-- The applicant review system has been removed. Drop the inline review columns.
ALTER TABLE "hacker_applicants"
  DROP COLUMN IF EXISTS "review_motivation",
  DROP COLUMN IF EXISTS "review_builder_mindset",
  DROP COLUMN IF EXISTS "review_collaboration",
  DROP COLUMN IF EXISTS "review_creativity",
  DROP COLUMN IF EXISTS "review_diversity",
  DROP COLUMN IF EXISTS "flag_for_review",
  DROP COLUMN IF EXISTS "review_notes";
