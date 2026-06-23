-- Collapse the "*_other" free-text columns into their main column, then drop
-- them. Custom values (where the user previously picked the "describe" option)
-- are merged into the main text column so no data is lost.

-- Personal Information
UPDATE "hacker_applicants"
  SET "gender" = "gender_other"
  WHERE "gender" = 'other' AND COALESCE("gender_other", '') <> '';
UPDATE "hacker_applicants"
  SET "ethnicity" = "ethnicity_other"
  WHERE "ethnicity" = 'multiracial' AND COALESCE("ethnicity_other", '') <> '';

-- Academic Information
UPDATE "hacker_applicants"
  SET "university" = "university_other"
  WHERE "university" = 'other' AND COALESCE("university_other", '') <> '';
UPDATE "hacker_applicants"
  SET "country" = "country_other"
  WHERE "country" = 'other' AND COALESCE("country_other", '') <> '';
UPDATE "hacker_applicants"
  SET "degree" = "degree_other"
  WHERE "degree" = 'other' AND COALESCE("degree_other", '') <> '';
UPDATE "hacker_applicants"
  SET "major" = "major_other"
  WHERE "major" = 'other' AND COALESCE("major_other", '') <> '';

ALTER TABLE "hacker_applicants"
  DROP COLUMN IF EXISTS "gender_other",
  DROP COLUMN IF EXISTS "ethnicity_other",
  DROP COLUMN IF EXISTS "university_other",
  DROP COLUMN IF EXISTS "country_other",
  DROP COLUMN IF EXISTS "degree_other",
  DROP COLUMN IF EXISTS "major_other";
