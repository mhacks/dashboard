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
