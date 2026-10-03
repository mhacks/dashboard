-- Local dev: team registration (invites), table reservation, and Devpost windows
-- stay open after db:reset. Relative to seed time so they do not expire mid-session.

insert into public.team_registration_settings (id, opens_at, closes_at)
values ('default', now() - interval '1 day', now() + interval '90 days')
on conflict (id) do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at;

insert into public.judging_settings (id, reservations_open_at, reservations_close_at)
values ('default', now() - interval '1 day', now() + interval '90 days')
on conflict (id) do update set
  reservations_open_at = excluded.reservations_open_at,
  reservations_close_at = excluded.reservations_close_at;

insert into public.submission_settings (id, opens_at, closes_at)
values ('default', now() - interval '1 day', now() + interval '90 days')
on conflict (id) do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at;
