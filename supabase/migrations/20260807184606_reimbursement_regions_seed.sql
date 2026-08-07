-- Restores the six reimbursement tiers to the migration path.
--
-- These rows are reference data, not seed data: hacker_reimbursements.region
-- is NOT NULL and foreign-keys to this table, so with it empty every possible
-- region (0-5) fails the FK and no reimbursement can be recorded at all.
-- supabase/seeds/ is local-only — CD runs `drizzle-kit migrate` and
-- `supabase config push`, never the seed files — so tiers defined only there
-- exist on developer machines and nowhere else.
--
-- The identical INSERT in supabase/seeds/application-review-demo.sql is
-- harmless and left in place; both sides use ON CONFLICT DO NOTHING, so
-- whichever runs first wins and a replay can't clobber a tier an organizer has
-- since adjusted.
INSERT INTO "reimbursement_regions" ("region", "label", "amount_cents") VALUES
  (0, 'Region 0', 0),
  (1, 'Region 1', 5000),
  (2, 'Region 2', 10000),
  (3, 'Region 3', 20000),
  (4, 'Region 4', 30000),
  (5, 'Region 5', 40000)
ON CONFLICT ("region") DO NOTHING;
