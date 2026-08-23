CREATE TRIGGER "hacker_reimbursements_set_updated_at" BEFORE UPDATE ON "public"."hacker_reimbursements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
