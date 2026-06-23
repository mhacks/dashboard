-- The MLH agreement checkboxes are still required in the application form, but
-- acceptance is implied by submitting, so the values are no longer persisted.
-- Drop the columns.
ALTER TABLE "hacker_applicants"
  DROP COLUMN IF EXISTS "mlh_code_of_conduct",
  DROP COLUMN IF EXISTS "mlh_privacy_policy",
  DROP COLUMN IF EXISTS "mlh_emails";
