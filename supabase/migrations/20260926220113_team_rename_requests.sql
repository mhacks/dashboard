ALTER TABLE "teams" ADD COLUMN "rename_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "rename_request_reason" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "rename_requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_rename_requested_by_user_id_users_id_fk" FOREIGN KEY ("rename_requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;