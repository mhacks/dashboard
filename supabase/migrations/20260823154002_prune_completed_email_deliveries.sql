CREATE TABLE "email_send_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"recipient_index" integer NOT NULL,
	"email" text NOT NULL,
	"merge_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_send_deliveries_run_recipient_unique" UNIQUE("run_id","recipient_index")
);
--> statement-breakpoint
ALTER TABLE "email_send_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "template_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "sent_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "failed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "next_cursor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "recent_failures" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "recovery_expires_at" timestamp with time zone;--> statement-breakpoint
WITH "batch_totals" AS (
	SELECT
		"run_id",
		COALESCE(sum("sent_count"), 0)::integer AS "sent_count",
		COALESCE(sum("failed_count"), 0)::integer AS "failed_count"
	FROM "email_send_batches"
	WHERE "status" = 'complete'
	GROUP BY "run_id"
)
UPDATE "email_send_runs"
SET
	"sent_count" = "batch_totals"."sent_count",
	"failed_count" = "batch_totals"."failed_count",
	"next_cursor" = "batch_totals"."sent_count" + "batch_totals"."failed_count"
FROM "batch_totals"
WHERE "email_send_runs"."id" = "batch_totals"."run_id";--> statement-breakpoint
UPDATE "email_send_runs"
SET
	"status" = 'superseded',
	"template_snapshot" = NULL,
	"updated_at" = now(),
	"completed_at" = COALESCE("completed_at", now())
WHERE "status" = 'sending';--> statement-breakpoint
UPDATE "email_send_runs"
SET "completed_at" = COALESCE("completed_at", "updated_at")
WHERE "status" NOT IN ('sending', 'test_sent');--> statement-breakpoint
DROP POLICY "email_send_batches_organizer_select" ON "email_send_batches" CASCADE;--> statement-breakpoint
DROP POLICY "email_send_batches_organizer_insert" ON "email_send_batches" CASCADE;--> statement-breakpoint
DROP POLICY "email_send_batches_organizer_update" ON "email_send_batches" CASCADE;--> statement-breakpoint
DROP TABLE "email_send_batches" CASCADE;--> statement-breakpoint
ALTER TABLE "email_send_deliveries" ADD CONSTRAINT "email_send_deliveries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."email_send_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_send_deliveries_run_status_idx" ON "email_send_deliveries" USING btree ("run_id","status","recipient_index");--> statement-breakpoint
CREATE UNIQUE INDEX "email_send_runs_active_fingerprint_unique" ON "email_send_runs" USING btree ("organizer_id","template_fingerprint","recipient_list_hash") WHERE "email_send_runs"."status" = 'sending';--> statement-breakpoint
CREATE POLICY "email_send_deliveries_organizer_select" ON "email_send_deliveries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "email_send_deliveries_organizer_insert" ON "email_send_deliveries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "email_send_deliveries_organizer_update" ON "email_send_deliveries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
)) WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));
