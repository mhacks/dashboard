CREATE TABLE "hacker_application_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"note" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_application_invitations_email_unique" UNIQUE("email"),
	CONSTRAINT "hacker_application_invitations_email_normalized" CHECK ("hacker_application_invitations"."email" = lower(btrim("hacker_application_invitations"."email")))
);
--> statement-breakpoint
ALTER TABLE "hacker_application_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_application_invitations" ADD CONSTRAINT "hacker_application_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hacker_application_invitations_expires_at_idx" ON "hacker_application_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE POLICY "hacker_application_invitations_organizer_select" ON "hacker_application_invitations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "hacker_application_invitations_organizer_insert" ON "hacker_application_invitations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "hacker_application_invitations_organizer_update" ON "hacker_application_invitations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_organizer())) WITH CHECK ((select public.is_organizer()));