CREATE TYPE "public"."reimbursement_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "hacker_reimbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"region" smallint NOT NULL,
	"status" "reimbursement_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hacker_reimbursements_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reimbursement_regions" (
	"region" smallint PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "reimbursement_regions_amount_cents_check" CHECK ("reimbursement_regions"."amount_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "reimbursement_regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ADD CONSTRAINT "hacker_reimbursements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ADD CONSTRAINT "hacker_reimbursements_region_fkey" FOREIGN KEY ("region") REFERENCES "public"."reimbursement_regions"("region") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_reimbursements" ADD CONSTRAINT "hacker_reimbursements_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "hacker_reimbursements_select_own_or_organizer" ON "hacker_reimbursements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hacker_reimbursements"."user_id" = (select auth.uid()) OR exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_reimbursements_organizer_insert" ON "hacker_reimbursements" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "hacker_reimbursements_organizer_update" ON "hacker_reimbursements" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
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
CREATE POLICY "hacker_reimbursements_organizer_delete" ON "hacker_reimbursements" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "reimbursement_regions_select_authenticated" ON "reimbursement_regions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);