CREATE TABLE "discord_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_username" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_accounts_discord_user_id_unique" UNIQUE("discord_user_id")
);
--> statement-breakpoint
ALTER TABLE "discord_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discord_accounts" ADD CONSTRAINT "discord_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "discord_accounts_select_own_or_organizer" ON "discord_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("discord_accounts"."user_id" = (select auth.uid()) OR (select public.is_organizer()));