-- Keep updated_at current on every UPDATE.
CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS trigger AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "hacker_applicants_set_updated_at"
  BEFORE UPDATE ON "hacker_applicants"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "hacker_application_drafts_set_updated_at"
  BEFORE UPDATE ON "hacker_application_drafts"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

-- Auto-insert a users row whenever a new Supabase auth user signs up.
CREATE OR REPLACE FUNCTION "handle_new_user"()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "handle_new_user"();
