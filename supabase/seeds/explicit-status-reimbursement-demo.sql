-- Explicit demo users for application review status, admissions decisions, and
-- travel reimbursement tiers. Login with any *@mhacks.test email via OTP in
-- Mailpit after `pnpm db:reset`.
--
-- | Email                         | status   | decision         | Reimbursement        |
-- |-------------------------------|----------|------------------|----------------------|
-- | pending-no-travel@mhacks.test | pending  | applied          | none                 |
-- | pending-needs-travel@...      | pending  | applied          | requested, no award  |
-- | accepted-50@mhacks.test       | reviewed | early_accepted   | region 1, $50        |
-- | accepted-100@mhacks.test      | reviewed | early_accepted   | region 2, $100       |
-- | accepted-200@mhacks.test      | reviewed | early_accepted   | region 3, $200       |
-- | accepted-300@mhacks.test      | reviewed | early_accepted   | region 4, $300       |
-- | accepted-400@mhacks.test      | reviewed | early_accepted   | region 5, $400       |
-- | accepted-region0@mhacks.test  | reviewed | early_accepted   | region 0, $0         |
-- | accepted-denied-travel@...    | reviewed | early_accepted   | region 3, denied     |
-- | accepted-no-award@mhacks.test | reviewed | early_accepted   | none (declined copy) |
-- | flagged-needs-travel@...      | flagged  | applied          | region 4, $300       |
-- | early-rejected@mhacks.test    | reviewed | early_rejected   | none                 |

with explicit_users(
  n,
  email,
  first_name,
  last_name,
  status,
  decision,
  needs_travel_reimbursement,
  reimbursement_region,
  reimbursement_status,
  reimbursement_notes
) as (
  values
    (
      301,
      'pending-no-travel@mhacks.test',
      'Pending',
      'NoTravel',
      'pending'::application_status,
      'applied'::application_decision,
      false,
      null::smallint,
      null::reimbursement_status,
      null::text
    ),
    (
      302,
      'pending-needs-travel@mhacks.test',
      'Pending',
      'NeedsTravel',
      'pending'::application_status,
      'applied'::application_decision,
      true,
      null,
      null,
      null
    ),
    (
      303,
      'accepted-50@mhacks.test',
      'Accepted',
      'Fifty',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      1::smallint,
      'approved'::reimbursement_status,
      'Region 1 — $50 travel award.'
    ),
    (
      304,
      'accepted-100@mhacks.test',
      'Accepted',
      'Hundred',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      2::smallint,
      'approved'::reimbursement_status,
      'Region 2 — $100 travel award.'
    ),
    (
      305,
      'accepted-200@mhacks.test',
      'Accepted',
      'TwoHundred',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      3::smallint,
      'approved'::reimbursement_status,
      'Region 3 — $200 travel award.'
    ),
    (
      306,
      'accepted-300@mhacks.test',
      'Accepted',
      'ThreeHundred',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      4::smallint,
      'approved'::reimbursement_status,
      'Region 4 — $300 travel award.'
    ),
    (
      307,
      'accepted-400@mhacks.test',
      'Accepted',
      'FourHundred',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      5::smallint,
      'approved'::reimbursement_status,
      'Region 5 — $400 travel award.'
    ),
    (
      308,
      'accepted-region0@mhacks.test',
      'Accepted',
      'RegionZero',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      0::smallint,
      'approved'::reimbursement_status,
      'Region 0 — local tier, $0 payout.'
    ),
    (
      309,
      'accepted-denied-travel@mhacks.test',
      'Accepted',
      'DeniedTravel',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      3::smallint,
      'denied'::reimbursement_status,
      'Accepted for admission but travel reimbursement denied.'
    ),
    (
      310,
      'accepted-no-award@mhacks.test',
      'Accepted',
      'NoAward',
      'reviewed'::application_status,
      'early_accepted'::application_decision,
      true,
      null,
      null,
      null
    ),
    (
      311,
      'flagged-needs-travel@mhacks.test',
      'Flagged',
      'NeedsTravel',
      'flagged'::application_status,
      'applied'::application_decision,
      true,
      4::smallint,
      'approved'::reimbursement_status,
      'Flagged for organizer review; provisional $300 award.'
    ),
    (
      312,
      'early-rejected@mhacks.test',
      'Early',
      'Rejected',
      'reviewed'::application_status,
      'early_rejected'::application_decision,
      true,
      null,
      null,
      null
    )
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as reimbursement_id,
    email,
    first_name,
    last_name,
    status,
    decision,
    needs_travel_reimbursement,
    reimbursement_region,
    reimbursement_status,
    reimbursement_notes
  from explicit_users
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  user_id,
  'authenticated',
  'authenticated',
  email,
  null,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from seed_rows
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

with explicit_users(
  n,
  email,
  first_name,
  last_name,
  status,
  decision,
  needs_travel_reimbursement,
  reimbursement_region,
  reimbursement_status,
  reimbursement_notes
) as (
  values
    (301, 'pending-no-travel@mhacks.test', 'Pending', 'NoTravel', 'pending'::application_status, 'applied'::application_decision, false, null::smallint, null::reimbursement_status, null::text),
    (302, 'pending-needs-travel@mhacks.test', 'Pending', 'NeedsTravel', 'pending'::application_status, 'applied'::application_decision, true, null, null, null),
    (303, 'accepted-50@mhacks.test', 'Accepted', 'Fifty', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 1::smallint, 'approved'::reimbursement_status, 'Region 1 — $50 travel award.'),
    (304, 'accepted-100@mhacks.test', 'Accepted', 'Hundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 2::smallint, 'approved'::reimbursement_status, 'Region 2 — $100 travel award.'),
    (305, 'accepted-200@mhacks.test', 'Accepted', 'TwoHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 3::smallint, 'approved'::reimbursement_status, 'Region 3 — $200 travel award.'),
    (306, 'accepted-300@mhacks.test', 'Accepted', 'ThreeHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 4::smallint, 'approved'::reimbursement_status, 'Region 4 — $300 travel award.'),
    (307, 'accepted-400@mhacks.test', 'Accepted', 'FourHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 5::smallint, 'approved'::reimbursement_status, 'Region 5 — $400 travel award.'),
    (308, 'accepted-region0@mhacks.test', 'Accepted', 'RegionZero', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 0::smallint, 'approved'::reimbursement_status, 'Region 0 — local tier, $0 payout.'),
    (309, 'accepted-denied-travel@mhacks.test', 'Accepted', 'DeniedTravel', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 3::smallint, 'denied'::reimbursement_status, 'Accepted for admission but travel reimbursement denied.'),
    (310, 'accepted-no-award@mhacks.test', 'Accepted', 'NoAward', 'reviewed'::application_status, 'early_accepted'::application_decision, true, null, null, null),
    (311, 'flagged-needs-travel@mhacks.test', 'Flagged', 'NeedsTravel', 'flagged'::application_status, 'applied'::application_decision, true, 4::smallint, 'approved'::reimbursement_status, 'Flagged for organizer review; provisional $300 award.'),
    (312, 'early-rejected@mhacks.test', 'Early', 'Rejected', 'reviewed'::application_status, 'early_rejected'::application_decision, true, null, null, null)
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from explicit_users
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  user_id,
  user_id,
  user_id::text,
  jsonb_build_object('sub', user_id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from seed_rows
on conflict (id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

with explicit_users(
  n,
  email,
  first_name,
  last_name,
  status,
  decision,
  needs_travel_reimbursement,
  reimbursement_region,
  reimbursement_status,
  reimbursement_notes
) as (
  values
    (301, 'pending-no-travel@mhacks.test', 'Pending', 'NoTravel', 'pending'::application_status, 'applied'::application_decision, false, null::smallint, null::reimbursement_status, null::text),
    (302, 'pending-needs-travel@mhacks.test', 'Pending', 'NeedsTravel', 'pending'::application_status, 'applied'::application_decision, true, null, null, null),
    (303, 'accepted-50@mhacks.test', 'Accepted', 'Fifty', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 1::smallint, 'approved'::reimbursement_status, 'Region 1 — $50 travel award.'),
    (304, 'accepted-100@mhacks.test', 'Accepted', 'Hundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 2::smallint, 'approved'::reimbursement_status, 'Region 2 — $100 travel award.'),
    (305, 'accepted-200@mhacks.test', 'Accepted', 'TwoHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 3::smallint, 'approved'::reimbursement_status, 'Region 3 — $200 travel award.'),
    (306, 'accepted-300@mhacks.test', 'Accepted', 'ThreeHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 4::smallint, 'approved'::reimbursement_status, 'Region 4 — $300 travel award.'),
    (307, 'accepted-400@mhacks.test', 'Accepted', 'FourHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 5::smallint, 'approved'::reimbursement_status, 'Region 5 — $400 travel award.'),
    (308, 'accepted-region0@mhacks.test', 'Accepted', 'RegionZero', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 0::smallint, 'approved'::reimbursement_status, 'Region 0 — local tier, $0 payout.'),
    (309, 'accepted-denied-travel@mhacks.test', 'Accepted', 'DeniedTravel', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 3::smallint, 'denied'::reimbursement_status, 'Accepted for admission but travel reimbursement denied.'),
    (310, 'accepted-no-award@mhacks.test', 'Accepted', 'NoAward', 'reviewed'::application_status, 'early_accepted'::application_decision, true, null, null, null),
    (311, 'flagged-needs-travel@mhacks.test', 'Flagged', 'NeedsTravel', 'flagged'::application_status, 'applied'::application_decision, true, 4::smallint, 'approved'::reimbursement_status, 'Flagged for organizer review; provisional $300 award.'),
    (312, 'early-rejected@mhacks.test', 'Early', 'Rejected', 'reviewed'::application_status, 'early_rejected'::application_decision, true, null, null, null)
),
seed_rows as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from explicit_users
)
insert into public.users (id, email, role)
select user_id, email, 'hacker'
from seed_rows
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

with explicit_users(
  n,
  email,
  first_name,
  last_name,
  status,
  decision,
  needs_travel_reimbursement,
  reimbursement_region,
  reimbursement_status,
  reimbursement_notes
) as (
  values
    (301, 'pending-no-travel@mhacks.test', 'Pending', 'NoTravel', 'pending'::application_status, 'applied'::application_decision, false, null::smallint, null::reimbursement_status, null::text),
    (302, 'pending-needs-travel@mhacks.test', 'Pending', 'NeedsTravel', 'pending'::application_status, 'applied'::application_decision, true, null, null, null),
    (303, 'accepted-50@mhacks.test', 'Accepted', 'Fifty', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 1::smallint, 'approved'::reimbursement_status, 'Region 1 — $50 travel award.'),
    (304, 'accepted-100@mhacks.test', 'Accepted', 'Hundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 2::smallint, 'approved'::reimbursement_status, 'Region 2 — $100 travel award.'),
    (305, 'accepted-200@mhacks.test', 'Accepted', 'TwoHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 3::smallint, 'approved'::reimbursement_status, 'Region 3 — $200 travel award.'),
    (306, 'accepted-300@mhacks.test', 'Accepted', 'ThreeHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 4::smallint, 'approved'::reimbursement_status, 'Region 4 — $300 travel award.'),
    (307, 'accepted-400@mhacks.test', 'Accepted', 'FourHundred', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 5::smallint, 'approved'::reimbursement_status, 'Region 5 — $400 travel award.'),
    (308, 'accepted-region0@mhacks.test', 'Accepted', 'RegionZero', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 0::smallint, 'approved'::reimbursement_status, 'Region 0 — local tier, $0 payout.'),
    (309, 'accepted-denied-travel@mhacks.test', 'Accepted', 'DeniedTravel', 'reviewed'::application_status, 'early_accepted'::application_decision, true, 3::smallint, 'denied'::reimbursement_status, 'Accepted for admission but travel reimbursement denied.'),
    (310, 'accepted-no-award@mhacks.test', 'Accepted', 'NoAward', 'reviewed'::application_status, 'early_accepted'::application_decision, true, null, null, null),
    (311, 'flagged-needs-travel@mhacks.test', 'Flagged', 'NeedsTravel', 'flagged'::application_status, 'applied'::application_decision, true, 4::smallint, 'approved'::reimbursement_status, 'Flagged for organizer review; provisional $300 award.'),
    (312, 'early-rejected@mhacks.test', 'Early', 'Rejected', 'reviewed'::application_status, 'early_rejected'::application_decision, true, null, null, null)
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    first_name,
    last_name,
    status,
    decision,
    needs_travel_reimbursement
  from explicit_users
)
insert into public.hacker_applicants (
  id,
  user_id,
  status,
  decision,
  first_name,
  last_name,
  phone_number,
  age,
  gender,
  ethnicity,
  university,
  country,
  degree,
  graduation_year,
  previous_hackathons,
  major,
  resume,
  what_would_you_do,
  why_mhacks,
  hill_to_die_on,
  anything_else,
  transportation_type,
  coming_from,
  shirt_size,
  allergies_description,
  needs_travel_reimbursement,
  would_attend_without_reimbursement,
  airport_code,
  github,
  linkedin,
  personal_site,
  follows_instagram,
  sponsor_emails
)
select
  application_id,
  user_id,
  status,
  decision,
  first_name,
  last_name,
  '+1415555' || lpad((3000 + n)::text, 4, '0'),
  20 + (n % 5),
  case n % 3
    when 0 then 'Female'
    when 1 then 'Male'
    else 'Non-binary'
  end,
  'Asian',
  'University of Michigan',
  'United States',
  'Bachelor''s',
  2027,
  n % 4,
  'Computer Science',
  null,
  'I would build a tool that helps hackathon teams coordinate travel plans and reimbursement paperwork before the event.',
  'I want to attend MHacks to meet ambitious builders and ship something meaningful in a weekend.',
  'Demo early, demo often',
  case
    when status = 'flagged'::application_status then 'Seeded for explicit status and reimbursement testing.'
    else null
  end,
  case when needs_travel_reimbursement then 'Flying' else 'Driving' end,
  case when needs_travel_reimbursement then 'San Francisco, CA' else 'Ann Arbor, MI' end,
  'M',
  null,
  needs_travel_reimbursement,
  case when needs_travel_reimbursement then n % 2 = 0 else null end,
  case when needs_travel_reimbursement then 'SFO' else null end,
  'https://github.com/explicit-' || n,
  null,
  null,
  true,
  true
from seed_rows
on conflict (user_id) do update set
  status = excluded.status,
  decision = excluded.decision,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone_number = excluded.phone_number,
  age = excluded.age,
  gender = excluded.gender,
  ethnicity = excluded.ethnicity,
  university = excluded.university,
  country = excluded.country,
  degree = excluded.degree,
  graduation_year = excluded.graduation_year,
  previous_hackathons = excluded.previous_hackathons,
  major = excluded.major,
  resume = excluded.resume,
  what_would_you_do = excluded.what_would_you_do,
  why_mhacks = excluded.why_mhacks,
  hill_to_die_on = excluded.hill_to_die_on,
  anything_else = excluded.anything_else,
  transportation_type = excluded.transportation_type,
  coming_from = excluded.coming_from,
  shirt_size = excluded.shirt_size,
  allergies_description = excluded.allergies_description,
  needs_travel_reimbursement = excluded.needs_travel_reimbursement,
  would_attend_without_reimbursement = excluded.would_attend_without_reimbursement,
  airport_code = excluded.airport_code,
  github = excluded.github,
  linkedin = excluded.linkedin,
  personal_site = excluded.personal_site,
  follows_instagram = excluded.follows_instagram,
  sponsor_emails = excluded.sponsor_emails;

with explicit_users(
  n,
  reimbursement_region,
  reimbursement_status,
  reimbursement_notes
) as (
  values
    (303, 1::smallint, 'approved'::reimbursement_status, 'Region 1 — $50 travel award.'),
    (304, 2::smallint, 'approved'::reimbursement_status, 'Region 2 — $100 travel award.'),
    (305, 3::smallint, 'approved'::reimbursement_status, 'Region 3 — $200 travel award.'),
    (306, 4::smallint, 'approved'::reimbursement_status, 'Region 4 — $300 travel award.'),
    (307, 5::smallint, 'approved'::reimbursement_status, 'Region 5 — $400 travel award.'),
    (308, 0::smallint, 'approved'::reimbursement_status, 'Region 0 — local tier, $0 payout.'),
    (309, 3::smallint, 'denied'::reimbursement_status, 'Accepted for admission but travel reimbursement denied.'),
    (311, 4::smallint, 'approved'::reimbursement_status, 'Flagged for organizer review; provisional $300 award.')
),
seed_reimbursements as (
  select
    ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    reimbursement_region as region,
    reimbursement_status as status,
    '00000000-0000-4000-8000-000000000001'::uuid as decided_by_user_id,
    now() - ((n % 24) || ' hours')::interval as decided_at,
    reimbursement_notes as notes
  from explicit_users
)
insert into public.hacker_reimbursements (
  id,
  user_id,
  region,
  status,
  decided_by_user_id,
  decided_at,
  notes
)
select
  id,
  user_id,
  region,
  status,
  decided_by_user_id,
  decided_at,
  notes
from seed_reimbursements
on conflict (user_id) do update set
  region = excluded.region,
  status = excluded.status,
  decided_by_user_id = excluded.decided_by_user_id,
  decided_at = excluded.decided_at,
  notes = excluded.notes;
