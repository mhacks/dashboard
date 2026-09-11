ALTER TABLE "broadcast_logs" ADD COLUMN "target" text DEFAULT 'email:hacker' NOT NULL;
--> statement-breakpoint
ALTER TABLE "broadcast_logs" RENAME COLUMN "recipient_emails" TO "recipients";
--> statement-breakpoint
ALTER TABLE "broadcast_logs" RENAME COLUMN "broadcasted_to_email" TO "delivered_to";
