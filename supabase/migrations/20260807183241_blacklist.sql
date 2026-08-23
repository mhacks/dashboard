CREATE TABLE "blacklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text,
	"full_name_normalized" text GENERATED ALWAYS AS (nullif(lower(regexp_replace(btrim("full_name"), '[[:space:]]+', ' ', 'g')), '')) STORED,
	"phone_number" text,
	"phone_number_normalized" text GENERATED ALWAYS AS (nullif(regexp_replace("phone_number", '[^0-9+]', '', 'g'), '')) STORED,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blacklist_identifier_present_check" CHECK ("blacklist"."full_name" is not null or "blacklist"."phone_number" is not null)
);
--> statement-breakpoint
ALTER TABLE "blacklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blacklist" ADD CONSTRAINT "blacklist_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blacklist_full_name_normalized_key" ON "blacklist" USING btree ("full_name_normalized") WHERE "blacklist"."full_name_normalized" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "blacklist_phone_number_normalized_key" ON "blacklist" USING btree ("phone_number_normalized") WHERE "blacklist"."phone_number_normalized" is not null;--> statement-breakpoint
CREATE POLICY "blacklist_organizer_select" ON "blacklist" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "blacklist_organizer_insert" ON "blacklist" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));--> statement-breakpoint
CREATE POLICY "blacklist_organizer_update" ON "blacklist" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
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
CREATE POLICY "blacklist_organizer_delete" ON "blacklist" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
  select 1
  from public.users
  where id = (select auth.uid())
    and role = 'organizer'
));