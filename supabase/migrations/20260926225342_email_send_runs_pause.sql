DROP INDEX "email_send_runs_active_fingerprint_unique";--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "email_send_runs_active_fingerprint_unique" ON "email_send_runs" USING btree ("template_fingerprint","recipient_list_hash") WHERE "email_send_runs"."status" = 'sending';