import { sql } from "drizzle-orm";

export const setUpdatedAtFn = sql`public.set_updated_at()`;

// Referenced by hacker_application_reviews.updated_at trigger in custom migration
// 20260715023217_is_organizer_realtime_and_triggers.sql. Drizzle-kit does not emit CREATE TRIGGER.
export const hackerApplicationReviewsSetUpdatedAtTriggerName =
  "hacker_application_reviews_set_updated_at";

// Referenced by hacker_reimbursements.updated_at trigger in custom migration
// 20260807101500_reimbursement_regions_seed_and_triggers.sql.
export const hackerReimbursementsSetUpdatedAtTriggerName =
  "hacker_reimbursements_set_updated_at";

// Referenced by blacklist.updated_at trigger in custom migration
// 20260807183257_blacklist_triggers.sql.
export const blacklistSetUpdatedAtTriggerName = "blacklist_set_updated_at";
