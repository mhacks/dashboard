CREATE TABLE "broadcast_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"omitted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "broadcast_deliveries_broadcast_recipient_unique" UNIQUE("broadcast_id","recipient"),
	CONSTRAINT "broadcast_deliveries_broadcast_position_unique" UNIQUE("broadcast_id","position")
);
--> statement-breakpoint
ALTER TABLE "broadcast_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "broadcast_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text DEFAULT 'email:hacker' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid,
	"status" text DEFAULT 'complete' NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"retry_failed_count" integer DEFAULT 0 NOT NULL,
	"next_cursor" integer DEFAULT 0 NOT NULL,
	"processing_recipient" text,
	"lease_expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "broadcast_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcast_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcast_deliveries_broadcast_status_idx" ON "broadcast_deliveries" USING btree ("broadcast_id","status","omitted");--> statement-breakpoint
CREATE UNIQUE INDEX "broadcast_logs_active_target_unique" ON "broadcast_logs" USING btree ("target") WHERE "broadcast_logs"."status" = 'sending';--> statement-breakpoint
CREATE INDEX "broadcast_logs_sent_at_idx" ON "broadcast_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "broadcast_logs_target_sent_at_idx" ON "broadcast_logs" USING btree ("target","sent_at");--> statement-breakpoint
CREATE POLICY "broadcast_deliveries_organizer_select" ON "broadcast_deliveries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "broadcast_deliveries_organizer_insert" ON "broadcast_deliveries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "broadcast_deliveries_organizer_update" ON "broadcast_deliveries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));