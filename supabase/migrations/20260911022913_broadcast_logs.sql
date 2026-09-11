CREATE TABLE "broadcast_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text DEFAULT 'email:hacker' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid,
	"status" text DEFAULT 'complete' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivered_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"next_cursor" integer DEFAULT 0 NOT NULL,
	"processing_recipient" text,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"recent_failures" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "broadcast_logs_active_target_unique" ON "broadcast_logs" USING btree ("target") WHERE "broadcast_logs"."status" = 'sending';