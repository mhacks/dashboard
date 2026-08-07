-- Reference data, not seed data: the reimbursement_regions rows are what
-- hacker_reimbursements.region foreign-keys against, so they must exist in
-- every environment. supabase/seed.sql and supabase/seeds/ are local-only.
-- DO NOTHING (not DO UPDATE) so a replay cannot clobber a tier that has since
-- been adjusted in place.
INSERT INTO "reimbursement_regions" ("region", "label", "amount_cents") VALUES
  (0, 'Region 0', 0),
  (1, 'Region 1', 5000),
  (2, 'Region 2', 10000),
  (3, 'Region 3', 20000),
  (4, 'Region 4', 30000),
  (5, 'Region 5', 40000)
ON CONFLICT ("region") DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER "hacker_reimbursements_set_updated_at" BEFORE UPDATE ON "public"."hacker_reimbursements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
