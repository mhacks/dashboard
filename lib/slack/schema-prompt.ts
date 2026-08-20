export const DATABASE_SCHEMA_PROMPT = `Tables (Postgres). Only these may appear in FROM/JOIN:

users (
  id uuid PK,
  email text unique not null,
  role user_role not null default 'hacker'  -- 'hacker' | 'organizer'
)

hacker_applicants (
  id uuid PK,
  user_id uuid not null unique references users(id),
  status application_status not null default 'pending'  -- 'pending' | 'reviewed' | 'flagged',
  first_name text not null,
  last_name text not null,
  phone_number text not null,
  age integer not null,
  gender text not null,
  ethnicity text not null,
  university text not null,
  country text not null,
  degree text not null,
  graduation_year integer not null,
  previous_hackathons integer not null,
  major text not null,
  resume text,
  what_would_you_do text not null,
  why_mhacks text not null,
  hill_to_die_on text not null,
  anything_else text,
  transportation_type text not null,
  coming_from text not null,
  shirt_size text not null,
  allergies_description text,
  needs_travel_reimbursement boolean not null,
  would_attend_without_reimbursement boolean,
  airport_code text,
  github text,
  linkedin text,
  personal_site text,
  follows_instagram boolean,
  sponsor_emails boolean,
  created_at timestamptz not null,
  updated_at timestamptz not null
)

hacker_application_drafts (
  user_id uuid PK references auth.users,
  data jsonb not null default '{}',
  updated_at timestamptz not null
)

hacker_application_reviews (
  id uuid PK,
  application_id uuid not null unique references hacker_applicants(id),
  reviewer_user_id uuid not null references users(id),
  effort_rating integer,          -- 1-5, null until scored
  builder_rating integer,         -- 1-5, null until scored
  flagged_for_review boolean not null default false,
  review_comments text,
  reviewed_at timestamptz,        -- set when the scorecard is completed
  created_at timestamptz not null,
  updated_at timestamptz not null
)

hacker_application_review_events (
  id uuid PK,
  review_id uuid not null references hacker_application_reviews(id),
  application_id uuid not null references hacker_applicants(id),
  reviewer_user_id uuid not null references users(id),
  event_type review_event_type not null,  -- 'draft_saved' | 'review_completed'
  changes jsonb not null,
  snapshot jsonb not null,
  created_at timestamptz not null
)

Join applicants to users on hacker_applicants.user_id = users.id for applicant email.
Join reviews to users on hacker_application_reviews.reviewer_user_id = users.id for reviewer email.
An application is submitted when a hacker_applicants row exists. Drafts in hacker_application_drafts are not submissions.
reviewed_at IS NULL means the scorecard is still a draft.
`;
