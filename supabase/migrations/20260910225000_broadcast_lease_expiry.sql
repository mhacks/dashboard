ALTER TABLE "broadcast_logs" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD COLUMN "lease_expires_at" timestamp with time zone;
