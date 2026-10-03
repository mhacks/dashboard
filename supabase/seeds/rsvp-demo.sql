-- Confirmed RSVPs for local development. Login with any *@mhacks.test email
-- via OTP in Mailpit after `pnpm db:reset`.
--
-- A confirmed RSVP is a hacker_rsvps row plus a decision of *_rsvped or
-- checked_in, which is what public.has_confirmed_rsvp() checks.
--
-- Everyone in this file is on a team, so the decision is checked_in.
--
-- | Email                              | decision   | Travel plan    | Team            |
-- |------------------------------------|------------|----------------|-----------------|
-- | early-rsvped@mhacks.test           | checked_in | local          | Example Team    |
-- | regular-rsvped@mhacks.test         | checked_in | self-funded    | Example Team    |
-- | rsvped-reimbursement@mhacks.test   | checked_in | reimbursement  | Example Team    |
-- | checked-in@mhacks.test             | checked_in | local          | Checked In      |
-- | checked-in-two@mhacks.test         | checked_in | local          | Checked In      |

with rsvp_users(
  n,
  email,
  first_name,
  last_name,
  decision,
  travel_plan,
  needs_travel_reimbursement,
  coming_from,
  street_address,
  city,
  state_or_province,
  postal_code,
  country
) as (
  values
    (
      321,
      'early-rsvped@mhacks.test',
      'Early',
      'Rsvped',
      'checked_in'::application_decision,
      'local'::rsvp_travel_plan,
      false,
      'Ann Arbor, MI',
      '500 S State St',
      'Ann Arbor',
      'MI',
      '48109',
      'United States'
    ),
    (
      322,
      'regular-rsvped@mhacks.test',
      'Regular',
      'Rsvped',
      'checked_in'::application_decision,
      'self-funded'::rsvp_travel_plan,
      false,
      'Chicago, IL',
      '5801 S Ellis Ave',
      'Chicago',
      'IL',
      '60637',
      'United States'
    ),
    (
      323,
      'rsvped-reimbursement@mhacks.test',
      'Reimbursed',
      'Rsvped',
      'checked_in'::application_decision,
      'reimbursement'::rsvp_travel_plan,
      true,
      'San Francisco, CA',
      '1 Dr Carlton B Goodlett Pl',
      'San Francisco',
      'CA',
      '94102',
      'United States'
    )
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from rsvp_users
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

with rsvp_users(n, email) as (
  values
    (321, 'early-rsvped@mhacks.test'),
    (322, 'regular-rsvped@mhacks.test'),
    (323, 'rsvped-reimbursement@mhacks.test')
),
seed_rows as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from rsvp_users
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

with rsvp_users(n, email) as (
  values
    (321, 'early-rsvped@mhacks.test'),
    (322, 'regular-rsvped@mhacks.test'),
    (323, 'rsvped-reimbursement@mhacks.test')
),
seed_rows as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from rsvp_users
)
insert into public.users (id, email, role)
select user_id, email, 'hacker'
from seed_rows
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

with rsvp_users(
  n,
  first_name,
  last_name,
  decision,
  needs_travel_reimbursement,
  coming_from
) as (
  values
    (321, 'Early', 'Rsvped', 'checked_in'::application_decision, false, 'Ann Arbor, MI'),
    (322, 'Regular', 'Rsvped', 'checked_in'::application_decision, false, 'Chicago, IL'),
    (323, 'Reimbursed', 'Rsvped', 'checked_in'::application_decision, true, 'San Francisco, CA')
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    first_name,
    last_name,
    decision,
    needs_travel_reimbursement,
    coming_from
  from rsvp_users
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
  'reviewed'::application_status,
  decision,
  first_name,
  last_name,
  '+1415555' || lpad((3000 + n)::text, 4, '0'),
  21,
  'Female',
  'Asian',
  'University of Michigan',
  'United States',
  'Bachelor''s',
  2027,
  2,
  'Computer Science',
  null,
  'I would build a tool that helps hackathon teams coordinate travel plans and reimbursement paperwork before the event.',
  'I want to attend MHacks to meet ambitious builders and ship something meaningful in a weekend.',
  'Demo early, demo often',
  null,
  case when needs_travel_reimbursement then 'Flying' else 'Driving' end,
  coming_from,
  'M',
  null,
  needs_travel_reimbursement,
  case when needs_travel_reimbursement then true else null end,
  case when needs_travel_reimbursement then 'SFO' else null end,
  'https://github.com/rsvp-' || n,
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
  needs_travel_reimbursement = excluded.needs_travel_reimbursement,
  would_attend_without_reimbursement = excluded.would_attend_without_reimbursement,
  airport_code = excluded.airport_code,
  transportation_type = excluded.transportation_type,
  coming_from = excluded.coming_from;

insert into public.hacker_reimbursements (
  id,
  user_id,
  region,
  status,
  decided_by_user_id,
  decided_at,
  notes
)
values (
  '40000000-0000-4000-8000-000000000323',
  '00000000-0000-4000-8000-000000000323',
  2,
  'approved',
  '00000000-0000-4000-8000-000000000001',
  now(),
  'Region 2 — $100 travel award. Seeded as a confirmed reimbursement RSVP.'
)
on conflict (user_id) do update set
  region = excluded.region,
  status = excluded.status,
  decided_by_user_id = excluded.decided_by_user_id,
  decided_at = excluded.decided_at,
  notes = excluded.notes;

with rsvp_users(
  n,
  travel_plan,
  street_address,
  city,
  state_or_province,
  postal_code,
  country
) as (
  values
    (321, 'local'::rsvp_travel_plan, '500 S State St', 'Ann Arbor', 'MI', '48109', 'United States'),
    (322, 'self-funded'::rsvp_travel_plan, '5801 S Ellis Ave', 'Chicago', 'IL', '60637', 'United States'),
    (323, 'reimbursement'::rsvp_travel_plan, '1 Dr Carlton B Goodlett Pl', 'San Francisco', 'CA', '94102', 'United States')
),
seed_rows as (
  select
    ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    travel_plan,
    street_address,
    city,
    state_or_province,
    postal_code,
    country
  from rsvp_users
)
insert into public.hacker_rsvps (
  id,
  user_id,
  application_id,
  travel_plan,
  travel_guide_acknowledged,
  flight_booked,
  receipt_key,
  receipt_original_name,
  receipt_content_type,
  receipt_size_bytes,
  receipt_binding_acknowledged,
  street_address,
  city,
  state_or_province,
  postal_code,
  country,
  activities_waiver_response,
  photo_release_response,
  additional_notes,
  submitted_at
)
select
  id,
  user_id,
  application_id,
  travel_plan,
  case when travel_plan = 'reimbursement' then true else null end,
  case when travel_plan = 'reimbursement' then true else null end,
  case
    when travel_plan = 'reimbursement' then 'rsvp-receipts/' || user_id::text
    else null
  end,
  case when travel_plan = 'reimbursement' then 'flight-receipt.pdf' else null end,
  case when travel_plan = 'reimbursement' then 'application/pdf' else null end,
  case when travel_plan = 'reimbursement' then 48211 else null end,
  case when travel_plan = 'reimbursement' then true else null end,
  street_address,
  city,
  state_or_province,
  postal_code,
  country,
  true,
  true,
  null,
  now()
from seed_rows
on conflict (user_id) do update set
  application_id = excluded.application_id,
  travel_plan = excluded.travel_plan,
  travel_guide_acknowledged = excluded.travel_guide_acknowledged,
  flight_booked = excluded.flight_booked,
  receipt_key = excluded.receipt_key,
  receipt_original_name = excluded.receipt_original_name,
  receipt_content_type = excluded.receipt_content_type,
  receipt_size_bytes = excluded.receipt_size_bytes,
  receipt_binding_acknowledged = excluded.receipt_binding_acknowledged,
  street_address = excluded.street_address,
  city = excluded.city,
  state_or_province = excluded.state_or_province,
  postal_code = excluded.postal_code,
  country = excluded.country,
  activities_waiver_response = excluded.activities_waiver_response,
  photo_release_response = excluded.photo_release_response,
  submitted_at = excluded.submitted_at;

-- Checked-in hackers are a separate set from the early RSVPs above. Their
-- decision is checked_in, which is what a door scan writes over regular_rsvped.
-- The scan rows themselves are inserted in seeds/live-site-demo.sql.
with checked_in_users(n, email, first_name, last_name) as (
  values
    (324, 'checked-in@mhacks.test', 'Checked', 'In'),
    (325, 'checked-in-two@mhacks.test', 'Checked', 'Two')
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    email,
    first_name,
    last_name
  from checked_in_users
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

with checked_in_users(n, email) as (
  values
    (324, 'checked-in@mhacks.test'),
    (325, 'checked-in-two@mhacks.test')
),
seed_rows as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from checked_in_users
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

with checked_in_users(n, email) as (
  values
    (324, 'checked-in@mhacks.test'),
    (325, 'checked-in-two@mhacks.test')
),
seed_rows as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    email
  from checked_in_users
)
insert into public.users (id, email, role)
select user_id, email, 'hacker'
from seed_rows
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

with checked_in_users(n, email, first_name, last_name) as (
  values
    (324, 'checked-in@mhacks.test', 'Checked', 'In'),
    (325, 'checked-in-two@mhacks.test', 'Checked', 'Two')
),
seed_rows as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    first_name,
    last_name
  from checked_in_users
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
  'reviewed'::application_status,
  'checked_in'::application_decision,
  first_name,
  last_name,
  '+1415555' || lpad((3000 + n)::text, 4, '0'),
  21,
  'Male',
  'White',
  'University of Michigan',
  'United States',
  'Bachelor''s',
  2027,
  1,
  'Computer Science',
  null,
  'I would build a tool that helps hackathon teams coordinate travel plans and reimbursement paperwork before the event.',
  'I want to attend MHacks to meet ambitious builders and ship something meaningful in a weekend.',
  'Demo early, demo often',
  null,
  'Driving',
  'Ann Arbor, MI',
  'L',
  null,
  false,
  null,
  null,
  'https://github.com/checked-in-' || n,
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
  phone_number = excluded.phone_number;

with checked_in_users(n) as (
  values (324), (325)
),
seed_rows as (
  select
    ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id
  from checked_in_users
)
insert into public.hacker_rsvps (
  id,
  user_id,
  application_id,
  travel_plan,
  street_address,
  city,
  state_or_province,
  postal_code,
  country,
  activities_waiver_response,
  photo_release_response,
  submitted_at
)
select
  id,
  user_id,
  application_id,
  'local',
  '530 S State St',
  'Ann Arbor',
  'MI',
  '48109',
  'United States',
  true,
  true,
  now()
from seed_rows
on conflict (user_id) do update set
  application_id = excluded.application_id,
  travel_plan = excluded.travel_plan,
  street_address = excluded.street_address,
  city = excluded.city,
  state_or_province = excluded.state_or_province,
  postal_code = excluded.postal_code,
  country = excluded.country,
  activities_waiver_response = excluded.activities_waiver_response,
  photo_release_response = excluded.photo_release_response,
  submitted_at = excluded.submitted_at;

-- The two checked-in hackers share a team. Early RSVP accounts stay off it.
insert into public.teams (id, name, created_by_user_id)
values (
  '00000000-0000-4000-8000-000000000331',
  'Checked In',
  '00000000-0000-4000-8000-000000000324'
)
on conflict (id) do update set
  name = excluded.name,
  created_by_user_id = excluded.created_by_user_id;

insert into public.team_members (user_id, team_id)
values
  (
    '00000000-0000-4000-8000-000000000324',
    '00000000-0000-4000-8000-000000000331'
  ),
  (
    '00000000-0000-4000-8000-000000000325',
    '00000000-0000-4000-8000-000000000331'
  )
on conflict (user_id) do update set
  team_id = excluded.team_id;
