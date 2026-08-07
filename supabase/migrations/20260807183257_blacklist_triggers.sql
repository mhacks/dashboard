CREATE TRIGGER "blacklist_set_updated_at" BEFORE UPDATE ON "public"."blacklist" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
