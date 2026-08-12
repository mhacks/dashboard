-- Reference data for the six reimbursement tiers.
--
-- hacker_reimbursements.region is NOT NULL and foreign-keys to this table, so
-- with it empty every possible region (0-5) fails the FK and no reimbursement
-- can be recorded at all.
INSERT INTO "reimbursement_regions" ("region", "label", "amount_cents") VALUES
  (0, 'Region 0', 0),
  (1, 'Region 1', 5000),
  (2, 'Region 2', 10000),
  (3, 'Region 3', 20000),
  (4, 'Region 4', 30000),
  (5, 'Region 5', 40000)
ON CONFLICT ("region") DO NOTHING;
