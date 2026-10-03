-- Example team for local development. Members are the checked-in hackers from
-- seeds/rsvp-demo.sql, which runs first. One seat stays open, with a pending
-- invite to an accepted hacker who has not checked in.
--
-- | Email                            | Role                         |
-- |----------------------------------|------------------------------|
-- | early-rsvped@mhacks.test        | member, created the team    |
-- | regular-rsvped@mhacks.test      | member                      |
-- | rsvped-reimbursement@mhacks.test| member                      |
-- | accepted-no-award@mhacks.test   | pending invite, not a member|

insert into public.teams (id, name, created_by_user_id, created_at)
values (
  '43000000-0000-4000-8000-000000000001',
  'Example Team',
  '00000000-0000-4000-8000-000000000321',
  now() - interval '1 hour'
)
on conflict (id) do update set
  name = excluded.name,
  created_by_user_id = excluded.created_by_user_id,
  created_at = excluded.created_at;

insert into public.team_members (user_id, team_id, joined_at)
values
  (
    '00000000-0000-4000-8000-000000000321',
    '43000000-0000-4000-8000-000000000001',
    now() - interval '1 hour'
  ),
  (
    '00000000-0000-4000-8000-000000000322',
    '43000000-0000-4000-8000-000000000001',
    now() - interval '50 minutes'
  ),
  (
    '00000000-0000-4000-8000-000000000323',
    '43000000-0000-4000-8000-000000000001',
    now() - interval '40 minutes'
  )
on conflict (user_id) do update set
  team_id = excluded.team_id,
  joined_at = excluded.joined_at;

insert into public.team_invitations (
  id,
  team_id,
  invited_user_id,
  invited_by_user_id,
  status,
  created_at,
  responded_at
)
values (
  '43000000-0000-4000-8000-000000000002',
  '43000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000310',
  '00000000-0000-4000-8000-000000000321',
  'pending',
  now() - interval '15 minutes',
  null
)
on conflict (id) do update set
  team_id = excluded.team_id,
  invited_user_id = excluded.invited_user_id,
  invited_by_user_id = excluded.invited_by_user_id,
  status = excluded.status,
  created_at = excluded.created_at,
  responded_at = excluded.responded_at;
