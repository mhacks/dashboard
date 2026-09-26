CREATE TABLE "discord_verification_codes" (
	"discord_user_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_verification_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "discord_verification_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text NOT NULL,
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_verification_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discord_verification_codes" ADD CONSTRAINT "discord_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discord_verification_sends_discord_user_id_sent_at_idx" ON "discord_verification_sends" USING btree ("discord_user_id","sent_at");--> statement-breakpoint
CREATE INDEX "discord_verification_sends_email_sent_at_idx" ON "discord_verification_sends" USING btree ("email","sent_at");--> statement-breakpoint
CREATE INDEX "discord_verification_sends_sent_at_idx" ON "discord_verification_sends" USING btree ("sent_at");