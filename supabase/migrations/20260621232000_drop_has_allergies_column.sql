-- Drop the redundant has_allergies boolean. A non-null/non-empty
-- allergies_description now implies the applicant has allergies or dietary
-- restrictions.
ALTER TABLE "hacker_applicants"
  DROP COLUMN IF EXISTS "has_allergies";
