-- Foreign keys to Supabase auth.users (kept out of the Drizzle schema so
-- drizzle-kit doesn't try to manage the auth schema). See lib/db/schema.ts.
alter table "hacker_applicants"
  add constraint "hacker_applicants_user_id_fkey"
  foreign key ("user_id") references "auth"."users" ("id") on delete cascade;

alter table "judge_applicants"
  add constraint "judge_applicants_user_id_fkey"
  foreign key ("user_id") references "auth"."users" ("id") on delete cascade;

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
