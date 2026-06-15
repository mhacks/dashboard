-- 1. profiles table (public schema, mirrors auth.users)
create table "profiles" (
  "id"          uuid primary key,
  "email"       text not null,
  "full_name"   text,
  "avatar_url"  text,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now()
);

-- FK: profiles.id → auth.users.id (cascade so deleting the auth user cleans up)
alter table "profiles"
  add constraint "profiles_id_fkey"
  foreign key ("id") references "auth"."users" ("id") on delete cascade;

-- 2. Trigger: auto-insert a profile row whenever a new auth user signs up
create or replace function "handle_new_user"()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger "on_auth_user_created"
  after insert on auth.users
  for each row execute function "handle_new_user"();

-- updated_at trigger for profiles
create trigger "profiles_set_updated_at"
  before update on "profiles"
  for each row execute function "set_updated_at"();

-- 3. Drop the old auth.users FKs on applicant tables and re-point to profiles
alter table "hacker_applicants"
  drop constraint "hacker_applicants_user_id_fkey";

alter table "hacker_applicants"
  add constraint "hacker_applicants_user_id_fkey"
  foreign key ("user_id") references "profiles" ("id") on delete cascade;

alter table "judge_applicants"
  drop constraint "judge_applicants_user_id_fkey";

alter table "judge_applicants"
  add constraint "judge_applicants_user_id_fkey"
  foreign key ("user_id") references "profiles" ("id") on delete cascade;
