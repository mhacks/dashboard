-- Staff users so organizer/volunteer/judge broadcast targets have recipients.
-- Hackers come from application-review-demo.sql; this file only checks them in.
-- Repeat the CTE per statement: supabase seed batches SQL, so temp tables do not persist.

with broadcast_demo_users as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    format('organizer-%s@mhacks.test', lpad((n - 20)::text, 2, '0')) as email,
    'organizer'::user_role as role
  from generate_series(21, 28) as n
  union all
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    format('volunteer-%s@mhacks.test', lpad((n - 200)::text, 2, '0')),
    'volunteer'::user_role
  from generate_series(201, 212) as n
  union all
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    format('judge-%s@mhacks.test', lpad((n - 400)::text, 2, '0')),
    'judge'::user_role
  from generate_series(401, 408) as n
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
from broadcast_demo_users
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

with broadcast_demo_users as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    format('organizer-%s@mhacks.test', lpad((n - 20)::text, 2, '0')) as email,
    'organizer'::user_role as role
  from generate_series(21, 28) as n
  union all
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    format('volunteer-%s@mhacks.test', lpad((n - 200)::text, 2, '0')),
    'volunteer'::user_role
  from generate_series(201, 212) as n
  union all
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    format('judge-%s@mhacks.test', lpad((n - 400)::text, 2, '0')),
    'judge'::user_role
  from generate_series(401, 408) as n
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
from broadcast_demo_users
on conflict (id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

with broadcast_demo_users as (
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    format('organizer-%s@mhacks.test', lpad((n - 20)::text, 2, '0')) as email,
    'organizer'::user_role as role
  from generate_series(21, 28) as n
  union all
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    format('volunteer-%s@mhacks.test', lpad((n - 200)::text, 2, '0')),
    'volunteer'::user_role
  from generate_series(201, 212) as n
  union all
  select
    ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    format('judge-%s@mhacks.test', lpad((n - 400)::text, 2, '0')),
    'judge'::user_role
  from generate_series(401, 408) as n
)
insert into public.users (id, email, role)
select id, email, role
from broadcast_demo_users
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role;

insert into public.events (
  id,
  slug,
  name,
  description,
  location,
  is_active,
  created_by
)
values (
  '70000000-0000-4000-8000-000000000001'::uuid,
  'broadcast-check-in',
  'Main check-in',
  'Seeded event so local hacker broadcasts have checked-in recipients.',
  'Pierpont Commons',
  true,
  '00000000-0000-4000-8000-000000000001'::uuid
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  location = excluded.location,
  is_active = excluded.is_active;

insert into public.event_checkins (
  event_id,
  user_id,
  checked_in_by,
  method
)
select
  '70000000-0000-4000-8000-000000000001'::uuid,
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  'manual'::checkin_method
from generate_series(101, 104) as n
union all
select
  '70000000-0000-4000-8000-000000000001'::uuid,
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  'manual'::checkin_method
from generate_series(111, 130) as n
on conflict (event_id, user_id) do nothing;

-- Demo broadcast history for local development.
-- Seeds 60 completed messages (3 pages at 25/page) with searchable subjects and senders.

insert into public.broadcast_logs (
  id,
  target,
  subject,
  body,
  sent_at,
  sent_by,
  status,
  total_recipients,
  sent_count,
  failed_count,
  retry_failed_count,
  next_cursor
)
select
  ('60000000-0000-4000-8000-' || lpad(message_number::text, 12, '0'))::uuid as id,
  'email:hacker' as target,
  case (message_number % 5)
    when 0 then 'Check-in desk moved to Ballroom A'
    when 1 then 'Meal service update for Saturday lunch'
    when 2 then 'Schedule change: opening ceremony'
    when 3 then 'Reminder: submit your hackathon project'
    else 'General update #' || message_number::text
  end as subject,
  case (message_number % 5)
    when 0 then 'Head to Ballroom A for check-in. Bring your student ID and QR code from the dashboard.'
    when 1 then 'Lunch lines are longest between 12:00 and 12:45. Consider eating after 1:00 PM if you can.'
    when 2 then 'Opening ceremony now starts at 6:30 PM in the main hall. Please arrive ten minutes early.'
    when 3 then 'Project submissions close Sunday at 9:00 AM. Upload your demo link before you sleep.'
    else 'This is broadcast message #' || message_number::text || ' for testing scroll and search in the admin feed.'
  end as body,
  now() - ((61 - message_number) * interval '45 minutes') as sent_at,
  case
    when message_number % 2 = 0 then '00000000-0000-4000-8000-000000000001'::uuid
    else '00000000-0000-4000-8000-000000000002'::uuid
  end as sent_by,
  'complete' as status,
  4 as total_recipients,
  case
    when message_number % 7 = 0 then 3
    else 4
  end as sent_count,
  case
    when message_number % 7 = 0 then 1
    else 0
  end as failed_count,
  case
    when message_number % 7 = 0 then 1
    else 0
  end as retry_failed_count,
  4 as next_cursor
from generate_series(1, 60) as message_number
on conflict (id) do update set
  target = excluded.target,
  subject = excluded.subject,
  body = excluded.body,
  sent_at = excluded.sent_at,
  sent_by = excluded.sent_by,
  status = excluded.status,
  total_recipients = excluded.total_recipients,
  sent_count = excluded.sent_count,
  failed_count = excluded.failed_count,
  retry_failed_count = excluded.retry_failed_count,
  next_cursor = excluded.next_cursor;

insert into public.broadcast_deliveries (
  broadcast_id,
  recipient,
  position,
  status,
  error,
  omitted
)
select
  ('60000000-0000-4000-8000-' || lpad(message_number::text, 12, '0'))::uuid,
  recipient.email,
  recipient.position,
  case
    when message_number % 7 = 0 and recipient.email = 'margaret@mhacks.test'
      then 'failed'
    else 'sent'
  end,
  case
    when message_number % 7 = 0 and recipient.email = 'margaret@mhacks.test'
      then 'Mailbox unavailable'
    else null
  end,
  false
from generate_series(1, 60) as message_number
cross join (
  values
    (0, 'ada@mhacks.test'),
    (1, 'grace@mhacks.test'),
    (2, 'katherine@mhacks.test'),
    (3, 'margaret@mhacks.test')
) as recipient(position, email)
on conflict (broadcast_id, recipient) do update set
  position = excluded.position,
  status = excluded.status,
  error = excluded.error,
  omitted = excluded.omitted;

-- Rich delivery-details fixture: 50 delivered, 50 failed, 50 omitted.
insert into public.broadcast_logs (
  id,
  target,
  subject,
  body,
  sent_at,
  sent_by,
  status,
  total_recipients,
  sent_count,
  failed_count,
  retry_failed_count,
  next_cursor
)
values (
  '60000000-0000-4000-8000-000000009999'::uuid,
  'email:hacker',
  'WiFi password update (delivery test)',
  'The venue WiFi password changed at 3 PM. Connect to MHacks-Venue and use the password posted in #announcements. Reply if you still cannot get online after restarting your laptop.',
  now() - interval '3 minutes',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'complete',
  150,
  50,
  100,
  50,
  150
)
on conflict (id) do update set
  target = excluded.target,
  subject = excluded.subject,
  body = excluded.body,
  sent_at = excluded.sent_at,
  sent_by = excluded.sent_by,
  status = excluded.status,
  total_recipients = excluded.total_recipients,
  sent_count = excluded.sent_count,
  failed_count = excluded.failed_count,
  retry_failed_count = excluded.retry_failed_count,
  next_cursor = excluded.next_cursor;

insert into public.broadcast_deliveries (
  broadcast_id,
  recipient,
  position,
  status,
  error,
  omitted
)
with failure_errors as (
  select *
  from (
    values
      (1, 'Mailbox unavailable'),
      (2, 'Address does not exist'),
      (3, 'Message rejected: recipient on suppression list'),
      (4, 'Connection timed out while sending'),
      (5, 'Email address is not verified'),
      (6, 'Bounce: mailbox full'),
      (7, 'Throttling failure - maximum send rate exceeded'),
      (8, 'Invalid domain'),
      (9, 'Account inactive'),
      (10, 'Temporary server error (421)'),
      (11, 'Message size exceeds maximum'),
      (12, 'DMARC policy rejection'),
      (13, 'SMTP protocol error: 503 Bad sequence of commands'),
      (14, '554 Transaction failed permanently'),
      (15, 'Recipient address rejected: access denied')
  ) as errors(error_index, message)
)
select
  '60000000-0000-4000-8000-000000009999'::uuid,
  format('delivered-%s@mhacks.test', lpad(recipient_number::text, 2, '0')),
  recipient_number - 1,
  'sent',
  null,
  false
from generate_series(1, 50) as recipient_number
union all
select
  '60000000-0000-4000-8000-000000009999'::uuid,
  format('failed-%s@mhacks.test', lpad(recipient_number::text, 2, '0')),
  50 + recipient_number - 1,
  'failed',
  failure_errors.message,
  false
from generate_series(1, 50) as recipient_number
join failure_errors
  on failure_errors.error_index = ((recipient_number - 1) % 15) + 1
union all
select
  '60000000-0000-4000-8000-000000009999'::uuid,
  format('omitted-%s@mhacks.test', lpad(recipient_number::text, 2, '0')),
  100 + recipient_number - 1,
  'failed',
  failure_errors.message,
  true
from generate_series(1, 50) as recipient_number
join failure_errors
  on failure_errors.error_index = ((recipient_number + 4) % 15) + 1
on conflict (broadcast_id, recipient) do update set
  position = excluded.position,
  status = excluded.status,
  error = excluded.error,
  omitted = excluded.omitted;
