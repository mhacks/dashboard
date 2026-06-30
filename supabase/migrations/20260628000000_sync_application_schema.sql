-- Align the local database with lib/db/schema/ so db:push does not need
-- interactive column-rename prompts (why_attend → what_would_you_do, etc.).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'hacker' NOT NULL;

-- judge_applicants missed the earlier cleanup migrations that only touched hacker_applicants.
UPDATE "judge_applicants"
  SET "gender" = "gender_other"
  WHERE "gender" = 'other' AND COALESCE("gender_other", '') <> '';
UPDATE "judge_applicants"
  SET "ethnicity" = "ethnicity_other"
  WHERE "ethnicity" = 'multiracial' AND COALESCE("ethnicity_other", '') <> '';
UPDATE "judge_applicants"
  SET "university" = "university_other"
  WHERE "university" = 'other' AND COALESCE("university_other", '') <> '';
UPDATE "judge_applicants"
  SET "country" = "country_other"
  WHERE "country" = 'other' AND COALESCE("country_other", '') <> '';
UPDATE "judge_applicants"
  SET "degree" = "degree_other"
  WHERE "degree" = 'other' AND COALESCE("degree_other", '') <> '';
UPDATE "judge_applicants"
  SET "major" = "major_other"
  WHERE "major" = 'other' AND COALESCE("major_other", '') <> '';

ALTER TABLE "judge_applicants"
  DROP COLUMN IF EXISTS "gender_other",
  DROP COLUMN IF EXISTS "ethnicity_other",
  DROP COLUMN IF EXISTS "university_other",
  DROP COLUMN IF EXISTS "country_other",
  DROP COLUMN IF EXISTS "degree_other",
  DROP COLUMN IF EXISTS "major_other",
  DROP COLUMN IF EXISTS "mlh_code_of_conduct",
  DROP COLUMN IF EXISTS "mlh_privacy_policy",
  DROP COLUMN IF EXISTS "mlh_emails",
  DROP COLUMN IF EXISTS "has_allergies";

-- Essay prompts were renamed in the application form.
ALTER TABLE "hacker_applicants" RENAME COLUMN "why_attend" TO "what_would_you_do";
ALTER TABLE "hacker_applicants" RENAME COLUMN "technical_challenge" TO "why_mhacks";
ALTER TABLE "hacker_applicants" RENAME COLUMN "proud_project" TO "hill_to_die_on";
ALTER TABLE "hacker_applicants" DROP COLUMN IF EXISTS "anything_else";

ALTER TABLE "judge_applicants" RENAME COLUMN "why_attend" TO "what_would_you_do";
ALTER TABLE "judge_applicants" RENAME COLUMN "technical_challenge" TO "why_mhacks";
ALTER TABLE "judge_applicants" RENAME COLUMN "proud_project" TO "hill_to_die_on";
ALTER TABLE "judge_applicants" DROP COLUMN IF EXISTS "anything_else";

CREATE TABLE IF NOT EXISTS "hacker_application_drafts" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "hacker_application_drafts"
  DROP CONSTRAINT IF EXISTS "hacker_application_drafts_user_id_users_id_fk";
ALTER TABLE "hacker_application_drafts"
  ADD CONSTRAINT "hacker_application_drafts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
