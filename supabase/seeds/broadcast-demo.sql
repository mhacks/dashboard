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
  recipients,
  delivered_to,
  failed_count,
  next_cursor,
  recent_failures
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
  '["ada@mhacks.test","grace@mhacks.test","katherine@mhacks.test","margaret@mhacks.test"]'::jsonb as recipients,
  case
    when message_number % 7 = 0 then '["ada@mhacks.test","grace@mhacks.test","katherine@mhacks.test"]'::jsonb
    else '["ada@mhacks.test","grace@mhacks.test","katherine@mhacks.test","margaret@mhacks.test"]'::jsonb
  end as delivered_to,
  case
    when message_number % 7 = 0 then 1
    else 0
  end as failed_count,
  4 as next_cursor,
  case
    when message_number % 7 = 0 then
      '[{"recipient":"margaret@mhacks.test","error":"Mailbox unavailable"}]'::jsonb
    else '[]'::jsonb
  end as recent_failures
from generate_series(1, 60) as message_number
on conflict (id) do update set
  target = excluded.target,
  subject = excluded.subject,
  body = excluded.body,
  sent_at = excluded.sent_at,
  sent_by = excluded.sent_by,
  status = excluded.status,
  recipients = excluded.recipients,
  delivered_to = excluded.delivered_to,
  failed_count = excluded.failed_count,
  next_cursor = excluded.next_cursor,
  recent_failures = excluded.recent_failures;

-- Rich delivery-details fixture: 50 delivered, 50 failed, 50 omitted.
insert into public.broadcast_logs (
  id,
  target,
  subject,
  body,
  sent_at,
  sent_by,
  status,
  recipients,
  delivered_to,
  omitted_to,
  failed_count,
  next_cursor,
  recent_failures
)
with delivered as (
  select
    jsonb_agg(
      format('delivered-%s@mhacks.test', lpad(recipient_number::text, 2, '0'))
      order by recipient_number
    ) as emails
  from generate_series(1, 50) as recipient_number
),
retry_recipients as (
  select
    format('failed-%s@mhacks.test', lpad(recipient_number::text, 2, '0')) as email,
    recipient_number
  from generate_series(1, 50) as recipient_number
),
omitted_recipients as (
  select
    format('omitted-%s@mhacks.test', lpad(recipient_number::text, 2, '0')) as email,
    recipient_number
  from generate_series(1, 50) as recipient_number
),
failure_errors as (
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
),
retry_failures as (
  select
    jsonb_agg(retry_recipients.email order by retry_recipients.recipient_number) as emails,
    jsonb_agg(
      jsonb_build_object(
        'recipient',
        retry_recipients.email,
        'error',
        failure_errors.message
      )
      order by retry_recipients.recipient_number
    ) as failures
  from retry_recipients
  join failure_errors
    on failure_errors.error_index = ((retry_recipients.recipient_number - 1) % 15) + 1
),
omitted as (
  select
    jsonb_agg(omitted_recipients.email order by omitted_recipients.recipient_number) as emails,
    jsonb_agg(
      jsonb_build_object(
        'recipient',
        omitted_recipients.email,
        'error',
        failure_errors.message
      )
      order by omitted_recipients.recipient_number
    ) as failures
  from omitted_recipients
  join failure_errors
    on failure_errors.error_index = ((omitted_recipients.recipient_number + 4) % 15) + 1
),
all_failures as (
  select retry_failures.failures || omitted.failures as failures
  from retry_failures
  cross join omitted
),
all_recipients as (
  select delivered.emails || retry_failures.emails || omitted.emails as emails
  from delivered
  cross join retry_failures
  cross join omitted
)
select
  '60000000-0000-4000-8000-000000009999'::uuid,
  'email:hacker',
  'WiFi password update (delivery test)',
  'The venue WiFi password changed at 3 PM. Connect to MHacks-Venue and use the password posted in #announcements. Reply if you still cannot get online after restarting your laptop.',
  now() - interval '3 minutes',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'complete',
  all_recipients.emails,
  delivered.emails,
  omitted.emails,
  100,
  150,
  all_failures.failures
from all_recipients
cross join delivered
cross join omitted
cross join all_failures
on conflict (id) do update set
  target = excluded.target,
  subject = excluded.subject,
  body = excluded.body,
  sent_at = excluded.sent_at,
  sent_by = excluded.sent_by,
  status = excluded.status,
  recipients = excluded.recipients,
  delivered_to = excluded.delivered_to,
  omitted_to = excluded.omitted_to,
  failed_count = excluded.failed_count,
  next_cursor = excluded.next_cursor,
  recent_failures = excluded.recent_failures;
