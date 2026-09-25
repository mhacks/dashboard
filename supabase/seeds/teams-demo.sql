-- Demo team data for local development — exercises the admin "all teams" view
-- (app/admin/teams). Covers: solo/partial/full teams, a hacker with no
-- application yet (email-fallback display name), pending/accepted/declined/
-- cancelled invitations, a hacker invited by multiple teams at once, and a
-- bulk block of 32 more teams (96 more members, reusing the bulk hackers from
-- application-review-demo.sql) for pagination and search testing.
--
-- Only inserts into public.users (not auth.users/auth.identities): these
-- accounts don't need to log in for this view, and public.users has no FK to
-- auth.users.

insert into public.users (id, email, role)
values
  ('40000000-0000-4000-8000-000000000101', 'priya@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000102', 'marcus@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000103', 'sofia@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000104', 'devon@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000105', 'yuki@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000106', 'omar@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000107', 'nina@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000108', 'leo@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000109', 'zara@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000110', 'theo@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000111', 'kwame@mhacks.test', 'hacker'),
  ('40000000-0000-4000-8000-000000000112', 'mia@mhacks.test', 'hacker')
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

-- Applications for everyone except Nina (...107), who is left without one on
-- purpose so her team shows the email-fallback display name in the admin view.
insert into public.hacker_applicants (
  id, user_id, status, first_name, last_name, phone_number, age, gender,
  ethnicity, university, country, degree, graduation_year,
  previous_hackathons, major, resume, what_would_you_do, why_mhacks,
  hill_to_die_on, anything_else, transportation_type, coming_from,
  shirt_size, allergies_description, needs_travel_reimbursement,
  would_attend_without_reimbursement, airport_code, github, linkedin,
  personal_site, follows_instagram, sponsor_emails
)
values
  ('40000000-0000-4000-8000-000000000201', '40000000-0000-4000-8000-000000000101', 'reviewed', 'Priya', 'Shah', '+14155550201', 21, 'Female', 'Asian', 'University of Michigan', 'United States', 'Bachelor''s', 2027, 2, 'Computer Science', null, 'A team formation tool.', 'To build with new people.', 'Ship early.', null, 'Driving', 'Ann Arbor, MI', 'S', null, false, null, null, 'https://github.com/priya-local', 'https://www.linkedin.com/in/priya-local', null, true, true),
  ('40000000-0000-4000-8000-000000000202', '40000000-0000-4000-8000-000000000102', 'reviewed', 'Marcus', 'Webb', '+14155550202', 22, 'Male', 'Black or African American', 'Michigan State University', 'United States', 'Bachelor''s', 2026, 1, 'Data Science', null, 'A campus wayfinding app.', 'To learn from other hackers.', 'Data over opinions.', null, 'Bus', 'East Lansing, MI', 'M', null, false, null, null, 'https://github.com/marcus-local', null, null, false, true),
  ('40000000-0000-4000-8000-000000000203', '40000000-0000-4000-8000-000000000103', 'pending', 'Sofia', 'Reyes', '+14155550203', 20, 'Female', 'Hispanic or Latino / Latina / Latinx', 'Wayne State University', 'United States', 'Bachelor''s', 2028, 0, 'Design', null, 'A live event-day dashboard.', 'To design under pressure.', 'Good UX is invisible.', null, 'Train', 'Detroit, MI', 'L', 'Vegetarian', false, null, null, 'https://github.com/sofia-local', 'https://www.linkedin.com/in/sofia-local', 'https://sofia.example.com', true, true),
  ('40000000-0000-4000-8000-000000000204', '40000000-0000-4000-8000-000000000104', 'reviewed', 'Devon', 'Clarke', '+14155550204', 23, 'Male', 'White', 'Purdue University', 'United States', 'Master''s', 2026, 4, 'Computer Engineering', null, 'An IoT badge scanner.', 'To build hardware fast.', 'Prototype, then polish.', null, 'Flying', 'Lafayette, IN', 'M', null, true, true, 'DTW', 'https://github.com/devon-local', 'https://www.linkedin.com/in/devon-local', null, true, false),
  ('40000000-0000-4000-8000-000000000205', '40000000-0000-4000-8000-000000000105', 'reviewed', 'Yuki', 'Tanaka', '+14155550205', 21, 'Female', 'Asian', 'University of Toronto', 'Canada', 'Bachelor''s', 2027, 3, 'Robotics', null, 'A robot arm demo.', 'To meet other builders.', 'Simplicity wins.', null, 'Flying', 'Toronto, ON', 'S', null, true, false, 'YYZ', 'https://github.com/yuki-local', null, null, true, true),
  ('40000000-0000-4000-8000-000000000206', '40000000-0000-4000-8000-000000000106', 'pending', 'Omar', 'Haddad', '+14155550206', 24, 'Male', 'Middle Eastern or North African', 'Georgia Institute of Technology', 'United States', 'Master''s', 2026, 5, 'Cybersecurity', null, 'A phishing-simulation trainer.', 'To break things responsibly.', 'Security is UX too.', null, 'Driving', 'Atlanta, GA', 'XL', null, false, null, null, 'https://github.com/omar-local', 'https://www.linkedin.com/in/omar-local', null, false, true),
  ('40000000-0000-4000-8000-000000000208', '40000000-0000-4000-8000-000000000108', 'reviewed', 'Leo', 'Fischer', '+14155550208', 22, 'Male', 'White', 'Carnegie Mellon University', 'United States', 'Bachelor''s', 2027, 2, 'Human-Computer Interaction', null, 'A gesture-based presenter remote.', 'To prototype quickly.', 'Latency is a feature.', null, 'Bus', 'Pittsburgh, PA', 'M', null, false, null, null, 'https://github.com/leo-local', null, null, true, false),
  ('40000000-0000-4000-8000-000000000209', '40000000-0000-4000-8000-000000000109', 'pending', 'Zara', 'Ali', '+14155550209', 20, 'Female', 'South Asian', 'University of Waterloo', 'Canada', 'Bachelor''s', 2028, 1, 'Software Engineering', null, 'A resume-to-portfolio generator.', 'To join an ambitious team.', 'Docs are part of the product.', null, 'Flying', 'Waterloo, ON', 'S', null, true, true, 'YYZ', 'https://github.com/zara-local', 'https://www.linkedin.com/in/zara-local', null, true, true),
  ('40000000-0000-4000-8000-000000000210', '40000000-0000-4000-8000-000000000110', 'pending', 'Theo', 'Novak', '+14155550210', 23, 'Male', 'White', 'Ohio State University', 'United States', 'Bachelor''s', 2026, 3, 'Mathematics', null, 'A pricing-model visualizer.', 'To find a good team.', 'Math should be visual.', null, 'Driving', 'Columbus, OH', 'L', null, false, null, null, 'https://github.com/theo-local', null, null, false, true),
  ('40000000-0000-4000-8000-000000000211', '40000000-0000-4000-8000-000000000111', 'pending', 'Kwame', 'Boateng', '+14155550211', 21, 'Male', 'Black or African American', 'University of Illinois Urbana-Champaign', 'United States', 'Bachelor''s', 2027, 0, 'Electrical Engineering', null, 'A smart power-strip monitor.', 'To find teammates.', 'Measure twice.', null, 'Train', 'Urbana, IL', 'M', null, false, null, null, 'https://github.com/kwame-local', null, null, false, true),
  ('40000000-0000-4000-8000-000000000212', '40000000-0000-4000-8000-000000000112', 'reviewed', 'Mia', 'Andersson', '+14155550212', 22, 'Female', 'White', 'University of Illinois Urbana-Champaign', 'United States', 'Bachelor''s', 2026, 2, 'Statistics', null, 'A dataset-quality linter.', 'To lead a small team.', 'Clean data first.', null, 'Driving', 'Champaign, IL', 'S', null, false, null, null, 'https://github.com/mia-local', 'https://www.linkedin.com/in/mia-local', null, true, true)
on conflict (user_id) do update set
  status = excluded.status,
  first_name = excluded.first_name,
  last_name = excluded.last_name;

-- Teams: a partial team (3/4), a full team (4/4), a solo team with no
-- application on file (email fallback), and a solo team with an outbox.
insert into public.teams (id, name, created_by_user_id, created_at)
values
  ('41000000-0000-4000-8000-000000000001', 'Byte Me', '40000000-0000-4000-8000-000000000101', now() - interval '3 hours'),
  ('41000000-0000-4000-8000-000000000002', 'Ctrl Alt Elite', '40000000-0000-4000-8000-000000000104', now() - interval '2 hours'),
  ('41000000-0000-4000-8000-000000000003', 'Stack Overflowers', '40000000-0000-4000-8000-000000000107', now() - interval '90 minutes'),
  ('41000000-0000-4000-8000-000000000004', '404 Not Found', '40000000-0000-4000-8000-000000000112', now() - interval '30 minutes')
on conflict (id) do update set
  name = excluded.name,
  created_by_user_id = excluded.created_by_user_id;

insert into public.team_members (user_id, team_id, joined_at)
values
  ('40000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', now() - interval '3 hours'),
  ('40000000-0000-4000-8000-000000000102', '41000000-0000-4000-8000-000000000001', now() - interval '2 hours 50 minutes'),
  ('40000000-0000-4000-8000-000000000103', '41000000-0000-4000-8000-000000000001', now() - interval '2 hours 40 minutes'),
  ('40000000-0000-4000-8000-000000000104', '41000000-0000-4000-8000-000000000002', now() - interval '2 hours'),
  ('40000000-0000-4000-8000-000000000105', '41000000-0000-4000-8000-000000000002', now() - interval '1 hour 50 minutes'),
  ('40000000-0000-4000-8000-000000000106', '41000000-0000-4000-8000-000000000002', now() - interval '1 hour 40 minutes'),
  ('40000000-0000-4000-8000-000000000108', '41000000-0000-4000-8000-000000000002', now() - interval '1 hour 30 minutes'),
  ('40000000-0000-4000-8000-000000000107', '41000000-0000-4000-8000-000000000003', now() - interval '90 minutes'),
  ('40000000-0000-4000-8000-000000000112', '41000000-0000-4000-8000-000000000004', now() - interval '30 minutes')
on conflict (user_id) do update set
  team_id = excluded.team_id,
  joined_at = excluded.joined_at;

-- Invitations: pending (counted in the admin badge), plus accepted/declined/
-- cancelled history (not counted). Zara is invited by three different teams
-- at once — a hacker can hold several pending invites simultaneously.
insert into public.team_invitations (id, team_id, invited_user_id, invited_by_user_id, status, created_at, responded_at)
values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000109', '40000000-0000-4000-8000-000000000101', 'pending', now() - interval '20 minutes', null),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000110', '40000000-0000-4000-8000-000000000107', 'pending', now() - interval '15 minutes', null),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000111', '40000000-0000-4000-8000-000000000107', 'pending', now() - interval '10 minutes', null),
  ('42000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000109', '40000000-0000-4000-8000-000000000112', 'pending', now() - interval '5 minutes', null),
  ('42000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000102', '40000000-0000-4000-8000-000000000101', 'accepted', now() - interval '2 hours 55 minutes', now() - interval '2 hours 50 minutes'),
  ('42000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000111', '40000000-0000-4000-8000-000000000104', 'declined', now() - interval '1 hour 55 minutes', now() - interval '1 hour 45 minutes'),
  ('42000000-0000-4000-8000-000000000007', '41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000108', '40000000-0000-4000-8000-000000000107', 'cancelled', now() - interval '85 minutes', now() - interval '80 minutes')
on conflict (id) do update set
  status = excluded.status,
  responded_at = excluded.responded_at;

-- Bulk teams for pagination/search testing: 32 teams of 3, reusing the 96
-- bulk hacker accounts (hacker105@mhacks.test .. hacker200@mhacks.test)
-- seeded by application-review-demo.sql. None of them are on a team yet.
with team_names(name, idx) as (
  values
    ('Null Pointers', 1), ('Merge Conflict', 2), ('Syntax Terrors', 3),
    ('Off By One', 4), ('Stack Smashers', 5), ('The Byte Club', 6),
    ('Infinite Loopers', 7), ('Segfault Squad', 8), ('Hash Browns', 9),
    ('Race Condition', 10), ('Dead Code Society', 11), ('Quantum Bugs', 12),
    ('Recursive Thinkers', 13), ('Cache Money', 14), ('Kernel Panic', 15),
    ('Rubber Duck Debuggers', 16), ('Big O Energy', 17), ('Async Awaiters', 18),
    ('Tabs Not Spaces', 19), ('The Compilers', 20), ('404 Team Name', 21),
    ('Bit Flippers', 22), ('Lazy Evaluators', 23), ('Greedy Algorithms', 24),
    ('Halting Problem', 25), ('The Refactors', 26), ('Cold Boot', 27),
    ('Ctrl Z Crew', 28), ('Root Access', 29), ('Sudo Make Me A Team', 30),
    ('Binary Search Party', 31), ('The Interpreters', 32)
),
bulk_teams as (
  select
    t,
    ('41000000-0000-4000-8000-' || lpad((100 + t)::text, 12, '0'))::uuid as team_id,
    tn.name as team_name,
    ('00000000-0000-4000-8000-' || lpad((105 + (t - 1) * 3)::text, 12, '0'))::uuid as member1,
    ('00000000-0000-4000-8000-' || lpad((106 + (t - 1) * 3)::text, 12, '0'))::uuid as member2,
    ('00000000-0000-4000-8000-' || lpad((107 + (t - 1) * 3)::text, 12, '0'))::uuid as member3,
    now() - ((200 - t) || ' minutes')::interval as created_at
  from generate_series(1, 32) as t
  join team_names tn on tn.idx = t
)
insert into public.teams (id, name, created_by_user_id, created_at)
select team_id, team_name, member1, created_at
from bulk_teams
on conflict (id) do update set
  name = excluded.name,
  created_by_user_id = excluded.created_by_user_id;

with bulk_teams as (
  select
    t,
    ('41000000-0000-4000-8000-' || lpad((100 + t)::text, 12, '0'))::uuid as team_id,
    ('00000000-0000-4000-8000-' || lpad((105 + (t - 1) * 3)::text, 12, '0'))::uuid as member1,
    ('00000000-0000-4000-8000-' || lpad((106 + (t - 1) * 3)::text, 12, '0'))::uuid as member2,
    ('00000000-0000-4000-8000-' || lpad((107 + (t - 1) * 3)::text, 12, '0'))::uuid as member3,
    now() - ((200 - t) || ' minutes')::interval as created_at
  from generate_series(1, 32) as t
),
bulk_members as (
  select member1 as user_id, team_id, created_at from bulk_teams
  union all
  select member2, team_id, created_at + interval '1 minute' from bulk_teams
  union all
  select member3, team_id, created_at + interval '2 minutes' from bulk_teams
)
insert into public.team_members (user_id, team_id, joined_at)
select user_id, team_id, created_at
from bulk_members
on conflict (user_id) do update set
  team_id = excluded.team_id,
  joined_at = excluded.joined_at;
