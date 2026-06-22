-- Keep updated_at current on every UPDATE.
create or replace function "set_updated_at"()
returns trigger as $$
begin
  new."updated_at" = now();
  return new;
end;
$$ language plpgsql;

create trigger "hacker_applicants_set_updated_at"
  before update on "hacker_applicants"
  for each row execute function "set_updated_at"();

create trigger "judge_applicants_set_updated_at"
  before update on "judge_applicants"
  for each row execute function "set_updated_at"();

-- Auto-insert a users row whenever a new Supabase auth user signs up.
create or replace function "handle_new_user"()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger "on_auth_user_created"
  after insert on auth.users
  for each row execute function "handle_new_user"();
