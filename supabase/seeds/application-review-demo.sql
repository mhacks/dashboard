-- Demo reviewer data for local development.
with demo_users(id, email) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'organizer@mhacks.test'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'reviewer@mhacks.test'),
    ('00000000-0000-4000-8000-000000000101'::uuid, 'ada@mhacks.test'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'grace@mhacks.test'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'katherine@mhacks.test'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'margaret@mhacks.test')
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
  id,
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
from demo_users
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

with demo_users(id, email) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'organizer@mhacks.test'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'reviewer@mhacks.test'),
    ('00000000-0000-4000-8000-000000000101'::uuid, 'ada@mhacks.test'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'grace@mhacks.test'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'katherine@mhacks.test'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'margaret@mhacks.test')
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
  id,
  id,
  id::text,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from demo_users
on conflict (id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.users (id, email, role)
values
  ('00000000-0000-4000-8000-000000000001', 'organizer@mhacks.test', 'organizer'),
  ('00000000-0000-4000-8000-000000000002', 'reviewer@mhacks.test', 'organizer'),
  ('00000000-0000-4000-8000-000000000101', 'ada@mhacks.test', 'hacker'),
  ('00000000-0000-4000-8000-000000000102', 'grace@mhacks.test', 'hacker'),
  ('00000000-0000-4000-8000-000000000103', 'katherine@mhacks.test', 'hacker'),
  ('00000000-0000-4000-8000-000000000104', 'margaret@mhacks.test', 'hacker')
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

insert into public.hacker_applicants (
  id,
  user_id,
  status,
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
values
  (
    '10000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000101',
    'pending',
    'Ada',
    'Lovelace',
    '+14155550101',
    21,
    'Female',
    'White',
    'University of Michigan',
    'United States',
    'Bachelor''s',
    2027,
    2,
    'Computer Science',
    null,
    'I would build a beginner-friendly debugging playground that turns confusing runtime errors into visual stories. It would help new hackers learn by changing code and seeing exactly how state moves through a program.',
    'I want to attend MHacks because I learn best around people who are excited to build strange and useful things quickly. I am especially excited to meet other builders at Michigan, ship a polished demo, and get sharper at scoping ideas under pressure.',
    'Documentation is product design',
    'I am happiest on teams where everyone demos early and often.',
    'Train',
    'Ann Arbor, MI',
    'M',
    null,
    false,
    null,
    null,
    'https://github.com/ada-local',
    'https://www.linkedin.com/in/ada-local',
    'https://ada.example.com',
    true,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000102',
    'reviewed',
    'Grace',
    'Hopper',
    '+14155550102',
    24,
    'Female',
    'White',
    'Eastern Michigan University',
    'United States',
    'Master''s',
    2026,
    5,
    'Computer Engineering',
    null,
    'I would create a tiny compiler lab for high school students where they can write a toy language and watch it become bytecode. The goal would be to make systems feel playful instead of intimidating.',
    'MHacks feels like the right place to build something ambitious with people who care about craft. I want to attend because the event has a reputation for momentum, strong mentors, and hackers who are willing to teach each other.',
    'Small tools change big systems',
    'I enjoy mentoring first-time hackers and would love to help my team keep shipping.',
    'Driving',
    'Ypsilanti, MI',
    'S',
    'Vegetarian',
    false,
    null,
    null,
    'https://github.com/grace-local',
    'https://www.linkedin.com/in/grace-local',
    null,
    true,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000103',
    'flagged',
    'Katherine',
    'Johnson',
    '+14155550103',
    20,
    'Female',
    'Black or African American',
    'Wayne State University',
    'United States',
    'Bachelor''s',
    2028,
    1,
    'Mathematics',
    null,
    'I would build an accessibility-first route planner for large campuses that combines elevator status, crowding, weather, and class schedules. I want it to work even when data is messy or incomplete.',
    'I want to attend MHacks to work with a team that can push my prototype beyond a class project. I am interested in civic tech, maps, and accessibility, and I think the hackathon would help me test ideas with real users.',
    'Maps should tell the truth',
    'Flagged only to discuss travel reimbursement constraints with the team.',
    'Bus',
    'Detroit, MI',
    'L',
    null,
    true,
    true,
    null,
    'https://github.com/katherine-local',
    null,
    null,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000104',
    'pending',
    'Margaret',
    'Hamilton',
    '+14155550104',
    22,
    'Female',
    'White',
    'Michigan State University',
    'United States',
    'Bachelor''s',
    2027,
    3,
    'Data Science',
    null,
    'I would build a reliability dashboard for student organizations that checks forms, payments, schedules, and communication queues before event day. It would catch problems while they are still easy to fix.',
    'I want to come to MHacks because I like intense build weekends and I want to collaborate with designers and engineers outside my usual circle. My goal is to leave with a project people can actually keep using.',
    'Reliability is a feature',
    null,
    'Flying',
    'Lansing, MI',
    'M',
    'Peanut allergy',
    true,
    false,
    'LAN',
    'https://github.com/margaret-local',
    'https://www.linkedin.com/in/margaret-local',
    'https://margaret.example.com',
    true,
    true
  )
on conflict (user_id) do update set
  status = excluded.status,
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

insert into public.hacker_application_reviews (
  id,
  application_id,
  reviewer_user_id,
  effort_rating,
  builder_rating,
  flagged_for_review,
  review_comments,
  reviewed_at
)
values
  (
    '20000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    4,
    5,
    false,
    null,
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000103',
    '10000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000002',
    4,
    3,
    true,
    'Good application. Flagged so the team can talk through travel reimbursement constraints.',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000104',
    '10000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000002',
    3,
    null,
    false,
    null,
    null
  )
on conflict (application_id) do update set
  reviewer_user_id = excluded.reviewer_user_id,
  effort_rating = excluded.effort_rating,
  builder_rating = excluded.builder_rating,
  flagged_for_review = excluded.flagged_for_review,
  review_comments = excluded.review_comments,
  reviewed_at = excluded.reviewed_at;

insert into public.hacker_application_review_events (
  id,
  review_id,
  application_id,
  reviewer_user_id,
  event_type,
  changes,
  snapshot,
  created_at
)
values
  (
    '30000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'review_completed',
    '{"effortRating":{"from":null,"to":4},"builderRating":{"from":null,"to":5},"flaggedForReview":{"from":null,"to":false},"reviewedAt":{"from":null,"to":"seeded"}}',
    '{"effortRating":4,"builderRating":5,"flaggedForReview":false,"reviewComments":null,"reviewedAt":"seeded","applicationStatus":"reviewed"}',
    now() - interval '20 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000103',
    '20000000-0000-4000-8000-000000000103',
    '10000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000002',
    'review_completed',
    '{"effortRating":{"from":null,"to":4},"builderRating":{"from":null,"to":3},"flaggedForReview":{"from":null,"to":true},"reviewComments":{"from":null,"to":"Good application. Flagged so the team can talk through travel reimbursement constraints."},"reviewedAt":{"from":null,"to":"seeded"}}',
    '{"effortRating":4,"builderRating":3,"flaggedForReview":true,"reviewComments":"Good application. Flagged so the team can talk through travel reimbursement constraints.","reviewedAt":"seeded","applicationStatus":"flagged"}',
    now() - interval '15 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000104',
    '20000000-0000-4000-8000-000000000104',
    '10000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000002',
    'draft_saved',
    '{"effortRating":{"from":null,"to":3},"flaggedForReview":{"from":null,"to":false}}',
    '{"effortRating":3,"builderRating":null,"flaggedForReview":false,"reviewComments":null,"reviewedAt":null,"applicationStatus":"pending"}',
    now() - interval '10 minutes'
  )
on conflict (id) do update set
  review_id = excluded.review_id,
  application_id = excluded.application_id,
  reviewer_user_id = excluded.reviewer_user_id,
  event_type = excluded.event_type,
  changes = excluded.changes,
  snapshot = excluded.snapshot,
  created_at = excluded.created_at;

-- Bulk demo applicants for pagination and filter testing (96 more, 100 total).
with bulk_demo(n) as (
  select generate_series(105, 200)
),
bulk_users as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    'hacker' || n || '@mhacks.test' as email
  from bulk_demo
),
first_names(name, idx) as (
  values
    ('Alex', 1),
    ('Jordan', 2),
    ('Taylor', 3),
    ('Morgan', 4),
    ('Casey', 5),
    ('Riley', 6),
    ('Quinn', 7),
    ('Avery', 8),
    ('Blake', 9),
    ('Cameron', 10),
    ('Dakota', 11),
    ('Emery', 12),
    ('Finley', 13),
    ('Harper', 14),
    ('Jamie', 15),
    ('Kai', 16),
    ('Logan', 17),
    ('Noah', 18),
    ('Parker', 19),
    ('Reese', 20),
    ('Sage', 21),
    ('Skyler', 22),
    ('Tatum', 23),
    ('Wren', 24)
),
last_names(name, idx) as (
  values
    ('Chen', 1),
    ('Patel', 2),
    ('Nguyen', 3),
    ('Kim', 4),
    ('Garcia', 5),
    ('Williams', 6),
    ('Brown', 7),
    ('Davis', 8),
    ('Miller', 9),
    ('Wilson', 10),
    ('Moore', 11),
    ('Taylor', 12),
    ('Anderson', 13),
    ('Thomas', 14),
    ('Jackson', 15),
    ('White', 16),
    ('Harris', 17),
    ('Martin', 18),
    ('Thompson', 19),
    ('Robinson', 20)
),
universities(name, idx) as (
  values
    ('University of Michigan', 1),
    ('Michigan State University', 2),
    ('Wayne State University', 3),
    ('Eastern Michigan University', 4),
    ('University of Illinois Urbana-Champaign', 5),
    ('Purdue University', 6),
    ('Ohio State University', 7),
    ('Carnegie Mellon University', 8),
    ('Georgia Institute of Technology', 9),
    ('University of Waterloo', 10),
    ('MIT', 11),
    ('Stanford University', 12),
    ('UC Berkeley', 13),
    ('University of Toronto', 14),
    ('Cornell University', 15)
),
majors(name, idx) as (
  values
    ('Computer Science', 1),
    ('Computer Engineering', 2),
    ('Data Science', 3),
    ('Electrical Engineering', 4),
    ('Information Systems', 5),
    ('Mathematics', 6),
    ('Cognitive Science', 7),
    ('Design', 8),
    ('Business Analytics', 9),
    ('Robotics', 10)
),
bulk_profiles as (
  select
    b.n,
    b.user_id,
    b.application_id,
    b.email,
    fn.name as first_name,
    ln.name as last_name,
    case
      when b.n % 10 = 0 then 'flagged'
      when b.n % 3 = 0 then 'reviewed'
      else 'pending'
    end::application_status as status,
    u.name as university,
    m.name as major,
    case b.n % 4
      when 0 then 'Flying'
      when 1 then 'Driving'
      when 2 then 'Bus'
      else 'Train'
    end as transportation_type,
    case b.n % 5
      when 0 then 'Ann Arbor, MI'
      when 1 then 'Chicago, IL'
      when 2 then 'Detroit, MI'
      when 3 then 'Columbus, OH'
      else 'Toronto, ON'
    end as coming_from,
    (b.n % 4) + 1 as previous_hackathons,
    18 + (b.n % 8) as age,
    2026 + (b.n % 4) as graduation_year,
    b.n % 2 = 0 as needs_travel_reimbursement
  from bulk_users b
  join first_names fn on fn.idx = ((b.n - 1) % 24) + 1
  join last_names ln on ln.idx = ((b.n - 1) % 20) + 1
  join universities u on u.idx = ((b.n - 1) % 15) + 1
  join majors m on m.idx = ((b.n - 1) % 10) + 1
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
from bulk_profiles
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

with bulk_demo(n) as (
  select generate_series(105, 200)
),
bulk_users as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    'hacker' || n || '@mhacks.test' as email
  from bulk_demo
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
from bulk_users
on conflict (id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

with bulk_demo(n) as (
  select generate_series(105, 200)
),
bulk_users as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    'hacker' || n || '@mhacks.test' as email
  from bulk_demo
)
insert into public.users (id, email, role)
select user_id, email, 'hacker'
from bulk_users
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

with bulk_demo(n) as (
  select generate_series(105, 200)
),
bulk_users as (
  select
    n,
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as user_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    'hacker' || n || '@mhacks.test' as email
  from bulk_demo
),
first_names(name, idx) as (
  values
    ('Alex', 1),
    ('Jordan', 2),
    ('Taylor', 3),
    ('Morgan', 4),
    ('Casey', 5),
    ('Riley', 6),
    ('Quinn', 7),
    ('Avery', 8),
    ('Blake', 9),
    ('Cameron', 10),
    ('Dakota', 11),
    ('Emery', 12),
    ('Finley', 13),
    ('Harper', 14),
    ('Jamie', 15),
    ('Kai', 16),
    ('Logan', 17),
    ('Noah', 18),
    ('Parker', 19),
    ('Reese', 20),
    ('Sage', 21),
    ('Skyler', 22),
    ('Tatum', 23),
    ('Wren', 24)
),
last_names(name, idx) as (
  values
    ('Chen', 1),
    ('Patel', 2),
    ('Nguyen', 3),
    ('Kim', 4),
    ('Garcia', 5),
    ('Williams', 6),
    ('Brown', 7),
    ('Davis', 8),
    ('Miller', 9),
    ('Wilson', 10),
    ('Moore', 11),
    ('Taylor', 12),
    ('Anderson', 13),
    ('Thomas', 14),
    ('Jackson', 15),
    ('White', 16),
    ('Harris', 17),
    ('Martin', 18),
    ('Thompson', 19),
    ('Robinson', 20)
),
universities(name, idx) as (
  values
    ('University of Michigan', 1),
    ('Michigan State University', 2),
    ('Wayne State University', 3),
    ('Eastern Michigan University', 4),
    ('University of Illinois Urbana-Champaign', 5),
    ('Purdue University', 6),
    ('Ohio State University', 7),
    ('Carnegie Mellon University', 8),
    ('Georgia Institute of Technology', 9),
    ('University of Waterloo', 10),
    ('MIT', 11),
    ('Stanford University', 12),
    ('UC Berkeley', 13),
    ('University of Toronto', 14),
    ('Cornell University', 15)
),
majors(name, idx) as (
  values
    ('Computer Science', 1),
    ('Computer Engineering', 2),
    ('Data Science', 3),
    ('Electrical Engineering', 4),
    ('Information Systems', 5),
    ('Mathematics', 6),
    ('Cognitive Science', 7),
    ('Design', 8),
    ('Business Analytics', 9),
    ('Robotics', 10)
),
bulk_profiles as (
  select
    b.n,
    b.user_id,
    b.application_id,
    fn.name as first_name,
    ln.name as last_name,
    case
      when b.n % 10 = 0 then 'flagged'
      when b.n % 3 = 0 then 'reviewed'
      else 'pending'
    end::application_status as status,
    u.name as university,
    m.name as major,
    case b.n % 4
      when 0 then 'Flying'
      when 1 then 'Driving'
      when 2 then 'Bus'
      else 'Train'
    end as transportation_type,
    case b.n % 5
      when 0 then 'Ann Arbor, MI'
      when 1 then 'Chicago, IL'
      when 2 then 'Detroit, MI'
      when 3 then 'Columbus, OH'
      else 'Toronto, ON'
    end as coming_from,
    (b.n % 4) + 1 as previous_hackathons,
    18 + (b.n % 8) as age,
    2026 + (b.n % 4) as graduation_year,
    b.n % 2 = 0 as needs_travel_reimbursement
  from bulk_users b
  join first_names fn on fn.idx = ((b.n - 1) % 24) + 1
  join last_names ln on ln.idx = ((b.n - 1) % 20) + 1
  join universities u on u.idx = ((b.n - 1) % 15) + 1
  join majors m on m.idx = ((b.n - 1) % 10) + 1
)
insert into public.hacker_applicants (
  id,
  user_id,
  status,
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
  first_name,
  last_name,
  '+1415555' || lpad((1000 + (n % 9000))::text, 4, '0'),
  age,
  case n % 3
    when 0 then 'Female'
    when 1 then 'Male'
    else 'Non-binary'
  end,
  case n % 5
    when 0 then 'Asian'
    when 1 then 'White'
    when 2 then 'Black or African American'
    when 3 then 'Hispanic or Latino'
    else 'Two or More Races'
  end,
  university,
  case when n % 7 = 0 then 'Canada' else 'United States' end,
  case when n % 4 = 0 then 'Master''s' else 'Bachelor''s' end,
  graduation_year,
  previous_hackathons,
  major,
  null,
  'I would build a project that helps students collaborate on hackathon ideas before the event starts. The app would match people by skills, interests, and timezone so teams form faster.',
  'I want to attend MHacks because it is one of the best places to meet ambitious builders, learn from mentors, and ship something meaningful in a weekend.',
  case n % 4
    when 0 then 'Accessibility should be default'
    when 1 then 'Demo early, demo often'
    when 2 then 'Good docs save teams hours'
    else 'Sleep is part of the schedule'
  end,
  case when n % 6 = 0 then 'Happy to mentor first-time hackers on my team.' else null end,
  transportation_type,
  coming_from,
  case n % 4
    when 0 then 'S'
    when 1 then 'M'
    when 2 then 'L'
    else 'XL'
  end,
  case when n % 11 = 0 then 'Nut allergy' else null end,
  needs_travel_reimbursement,
  case when needs_travel_reimbursement then n % 3 = 0 else null end,
  case when transportation_type = 'Flying' then 'DTW' else null end,
  'https://github.com/hacker-' || n,
  case when n % 2 = 0 then 'https://www.linkedin.com/in/hacker-' || n else null end,
  case when n % 3 = 0 then 'https://hacker' || n || '.example.com' else null end,
  n % 2 = 0,
  n % 3 <> 0
from bulk_profiles
on conflict (user_id) do update set
  status = excluded.status,
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

-- Completed reviews for a subset of bulk applicants (reviewed + flagged statuses).
with bulk_reviews as (
  select
    ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as review_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as application_id,
    case when n % 2 = 0
      then '00000000-0000-4000-8000-000000000001'::uuid
      else '00000000-0000-4000-8000-000000000002'::uuid
    end as reviewer_user_id,
    2 + (n % 4) as effort_rating,
    case when n % 5 = 0 then null else 2 + (n % 4) end as builder_rating,
    n % 10 = 0 as flagged_for_review,
    case
      when n % 10 = 0 then 'Flagged for travel reimbursement discussion.'
      else null
    end as review_comments,
    now() - ((n % 48) || ' hours')::interval as reviewed_at
  from generate_series(105, 200) as n
  where n % 3 = 0 or n % 10 = 0
)
insert into public.hacker_application_reviews (
  id,
  application_id,
  reviewer_user_id,
  effort_rating,
  builder_rating,
  flagged_for_review,
  review_comments,
  reviewed_at
)
select
  review_id,
  application_id,
  reviewer_user_id,
  effort_rating,
  builder_rating,
  flagged_for_review,
  review_comments,
  reviewed_at
from bulk_reviews
on conflict (application_id) do update set
  reviewer_user_id = excluded.reviewer_user_id,
  effort_rating = excluded.effort_rating,
  builder_rating = excluded.builder_rating,
  flagged_for_review = excluded.flagged_for_review,
  review_comments = excluded.review_comments,
  reviewed_at = excluded.reviewed_at;
