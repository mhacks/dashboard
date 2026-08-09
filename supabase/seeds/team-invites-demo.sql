-- Demo team invite data for local development.
-- Covers pending, accepted, revoked, and expired states plus bulk rows for pagination.

insert into public.user_invitations (
  id,
  email,
  role,
  invited_by,
  accepted_at,
  revoked_at,
  expires_at,
  created_at
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    'reviewer@mhacks.test',
    'organizer',
    '00000000-0000-4000-8000-000000000001',
    now() - interval '3 days',
    null,
    now() + interval '4 days',
    now() - interval '3 days'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'pending-reviewer@mhacks.test',
    'organizer',
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    now() + interval '5 days',
    now() - interval '2 days'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    'pending-hacker@mhacks.test',
    'hacker',
    '00000000-0000-4000-8000-000000000002',
    null,
    null,
    now() + interval '6 days',
    now() - interval '1 day'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    'revoked-invite@mhacks.test',
    'organizer',
    '00000000-0000-4000-8000-000000000001',
    null,
    now() - interval '12 hours',
    now() + interval '3 days',
    now() - interval '4 days'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    'expired-invite@mhacks.test',
    'organizer',
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    now() - interval '2 days',
    now() - interval '9 days'
  ),
  (
    '50000000-0000-4000-8000-000000000006',
    'ops-lead@mhacks.test',
    'organizer',
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    now() + interval '7 days',
    now() - interval '6 hours'
  )
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  invited_by = excluded.invited_by,
  accepted_at = excluded.accepted_at,
  revoked_at = excluded.revoked_at,
  expires_at = excluded.expires_at,
  created_at = excluded.created_at;

-- Bulk pending invites for pagination and search testing (12 more, 18 total).
with bulk_invites(n) as (
  select generate_series(101, 112)
)
insert into public.user_invitations (
  id,
  email,
  role,
  invited_by,
  accepted_at,
  revoked_at,
  expires_at,
  created_at
)
select
  ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'bulk-invite-' || n || '@mhacks.test',
  case when n % 3 = 0 then 'hacker' else 'organizer' end::user_role,
  case
    when n % 2 = 0
      then '00000000-0000-4000-8000-000000000001'::uuid
    else '00000000-0000-4000-8000-000000000002'::uuid
  end,
  null,
  null,
  now() + ((n % 6) + 1 || ' days')::interval,
  now() - ((n % 72) || ' hours')::interval
from bulk_invites
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  invited_by = excluded.invited_by,
  accepted_at = excluded.accepted_at,
  revoked_at = excluded.revoked_at,
  expires_at = excluded.expires_at,
  created_at = excluded.created_at;
