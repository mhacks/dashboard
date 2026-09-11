CREATE TABLE "hacker_rsvp_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"note" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_rsvp_exceptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "hacker_rsvp_exceptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_rsvp_exceptions" ADD CONSTRAINT "hacker_rsvp_exceptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_rsvp_exceptions" ADD CONSTRAINT "hacker_rsvp_exceptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hacker_rsvp_exceptions_expires_at_idx" ON "hacker_rsvp_exceptions" USING btree ("expires_at");--> statement-breakpoint
CREATE POLICY "hacker_rsvp_exceptions_organizer_select" ON "hacker_rsvp_exceptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_rsvp_exceptions_organizer_insert" ON "hacker_rsvp_exceptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_rsvp_exceptions_organizer_update" ON "hacker_rsvp_exceptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
)) WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "hacker_rsvp_exceptions" FROM "anon", "authenticated";
