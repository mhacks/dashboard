CREATE TABLE "broadcast_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid,
	"broadcasted_to_email" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;