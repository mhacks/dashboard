-- Sync the Google Calendar into /live every minute by calling the
-- sync-live-calendar edge function, the same sync as the dashboard button.
-- The URL and secret live in Vault, not here; until both exist (local dev,
-- a fresh project) the job runs but sends nothing:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<CALENDAR_SYNC_SECRET>', 'calendar_sync_secret');
-- Stop it with: select cron.unschedule('sync-live-calendar');
CREATE EXTENSION IF NOT EXISTS pg_cron;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;--> statement-breakpoint
SELECT cron.schedule(
  'sync-live-calendar',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := url.decrypted_secret || '/functions/v1/sync-live-calendar',
    headers := jsonb_build_object('x-cron-secret', secret.decrypted_secret),
    timeout_milliseconds := 55000
  )
  FROM vault.decrypted_secrets url, vault.decrypted_secrets secret
  WHERE url.name = 'project_url' AND secret.name = 'calendar_sync_secret'
  $job$
);
