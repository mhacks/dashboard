DROP INDEX "email_send_runs_active_fingerprint_unique";--> statement-breakpoint
ALTER TABLE "email_send_runs" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
-- Hand-added. Before this change a send only ran while an organizer's browser
-- drove it, so stopping one left it in 'sending' for its 7-day recovery
-- window. The server-side sweep resumes every unpaused 'sending' run, and
-- would restart those deliberately stopped sends on deploy. Pause them all so
-- an organizer has to resume each one.
UPDATE "email_send_runs" SET "paused_at" = now() WHERE "status" = 'sending';--> statement-breakpoint
CREATE UNIQUE INDEX "email_send_runs_active_fingerprint_unique" ON "email_send_runs" USING btree ("template_fingerprint","recipient_list_hash") WHERE "email_send_runs"."status" = 'sending';
