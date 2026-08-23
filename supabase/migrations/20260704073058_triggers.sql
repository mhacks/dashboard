CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new."updated_at" = now();
  return new;
end;
$$;
--> statement-breakpoint
CREATE TRIGGER "hacker_applicants_set_updated_at" BEFORE UPDATE ON "public"."hacker_applicants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
--> statement-breakpoint
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "handle_new_user"();
