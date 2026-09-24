-- Production already has an "application_decision" type with no column using
-- it, left behind by a `drizzle-kit push` that created the type and never added
-- the column. A bare CREATE TYPE aborts on that, and because drizzle applies
-- every pending migration in one transaction, it takes the whole deploy with it.
--
-- Dropping first makes the migration land the same way on every database: the
-- enum that exists afterwards is the one spelled out below, whatever a stray
-- push may have left. The drop is deliberately not CASCADE -- an orphan has
-- nothing depending on it, so if this ever errors it means a column or function
-- is using the type and it must not be replaced silently.
DROP TYPE IF EXISTS "public"."application_decision";--> statement-breakpoint
CREATE TYPE "public"."application_decision" AS ENUM('applied', 'early_accepted', 'early_rsvped', 'early_rejected', 'regular_accepted', 'regular_rsvped', 'regular_rejected');--> statement-breakpoint
ALTER TABLE "hacker_applicants" ADD COLUMN "decision" "application_decision" DEFAULT 'applied' NOT NULL;
