ALTER TABLE "broadcast_logs" ADD COLUMN "status" text DEFAULT 'complete' NOT NULL;
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD COLUMN "recipient_emails" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD COLUMN "failed_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD COLUMN "next_cursor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD COLUMN "recent_failures" jsonb DEFAULT '[]'::jsonb NOT NULL;
