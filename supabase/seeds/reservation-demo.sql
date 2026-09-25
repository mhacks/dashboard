-- Demo hacker teams for table reservations (uses the shared teams / team_members model).
insert into public.teams (id, name, created_by_user_id)
values
  (
    '00000000-0000-4000-8000-000000002001',
    'Team Ada',
    '00000000-0000-4000-8000-000000000101'
  ),
  (
    '00000000-0000-4000-8000-000000002002',
    'Team Grace',
    '00000000-0000-4000-8000-000000000103'
  )
on conflict (id) do update
set
  name = excluded.name,
  created_by_user_id = excluded.created_by_user_id;

insert into public.team_members (user_id, team_id)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000002001'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000002001'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000002002'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000002002')
on conflict (user_id) do update set team_id = excluded.team_id;
