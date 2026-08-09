-- Local-only storage seed. Runs on first `supabase start` and every `supabase db reset`.
-- Not applied to the remote database (remote schema uses drizzle-kit migrate).
-- Production resume storage uses AWS S3, not Supabase Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Test hackers
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, email_confirmed_at, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'alice@test.com', '{}', '{}', false, now(), now(), now(), 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'bob@test.com',   '{}', '{}', false, now(), now(), now(), 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'carol@test.com', '{}', '{}', false, now(), now(), now(), 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'dave@test.com',  '{}', '{}', false, now(), now(), now(), 'authenticated', 'authenticated'),
  ('55555555-5555-4555-8555-555555555555', 'eve@test.com',   '{}', '{}', false, now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- public.users rows are created by the handle_new_user trigger above,
-- but we upsert here too so seed is idempotent on db reset.
insert into public.users (id, email, role)
values
  ('11111111-1111-4111-8111-111111111111', 'alice@test.com', 'hacker'),
  ('22222222-2222-4222-8222-222222222222', 'bob@test.com',   'hacker'),
  ('33333333-3333-4333-8333-333333333333', 'carol@test.com', 'hacker'),
  ('44444444-4444-4444-8444-444444444444', 'dave@test.com',  'hacker'),
  ('55555555-5555-4555-8555-555555555555', 'eve@test.com',   'hacker')
on conflict (id) do nothing;

insert into public.hacker_applicants (
  user_id, first_name, last_name, phone_number, age, gender, ethnicity,
  university, country, degree, graduation_year, previous_hackathons, major,
  what_would_you_do, why_mhacks, hill_to_die_on,
  transportation_type, coming_from, shirt_size, needs_travel_reimbursement
)
values
  ('11111111-1111-4111-8111-111111111111', 'Alice', 'Smith',   '+15550000001', 20, 'Female',         'Asian',             'University of Michigan',     'USA', 'Bachelor''s', 2026, 2, 'Computer Science',    'Build an AI study tool',        'MHacks is the best hackathon',  'Sleep is overrated',    'driving',  'Ann Arbor, MI',  'M',  false),
  ('22222222-2222-4222-8222-222222222222', 'Bob',   'Johnson', '+15550000002', 22, 'Male',           'Hispanic',          'MIT',                        'USA', 'Bachelor''s', 2025, 5, 'Electrical Engineering', 'Create a smart grid optimizer', 'Learning never stops',          'Tabs over spaces',      'flying',   'Boston, MA',     'L',  true),
  ('33333333-3333-4333-8333-333333333333', 'Carol', 'Lee',     '+15550000003', 21, 'Non-binary',     'Black',             'Stanford University',        'USA', 'Master''s',  2026, 3, 'Data Science',        'Visualize climate data',        'Stanford sent me here',         'Dark mode always',      'train',    'Palo Alto, CA',  'S',  false),
  ('44444444-4444-4444-8444-444444444444', 'Dave',  'Patel',   '+15550000004', 23, 'Male',           'South Asian',       'Carnegie Mellon University', 'USA', 'Bachelor''s', 2025, 7, 'Robotics',            'Build an autonomous drone',     'CMU robotics club represent',   'Python over everything','driving',  'Pittsburgh, PA', 'XL', true),
  ('55555555-5555-4555-8555-555555555555', 'Eve',   'Garcia',  '+15550000005', 19, 'Female',         'Latina',            'University of Texas Austin', 'USA', 'Bachelor''s', 2027, 1, 'Information Systems', 'Hack on accessibility tools',   'First hackathon, so excited!',  'Pineapple on pizza',    'bus',      'Austin, TX',     'S',  false)
on conflict (user_id) do nothing;
