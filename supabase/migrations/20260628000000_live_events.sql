create table if not exists public.live_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  location text not null,
  description text not null,
  event_type text not null default 'event',
  map_url text,
  is_published boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists live_events_starts_at_idx
  on public.live_events (starts_at);

create trigger live_events_set_updated_at
  before update on public.live_events
  for each row execute function public.set_updated_at();

alter table public.live_events enable row level security;

create policy "Published live events are public"
  on public.live_events
  for select
  using (is_published = true);
