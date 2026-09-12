CREATE TABLE "email_hidden_seed_templates" (
	"source_template_id" text PRIMARY KEY NOT NULL,
	"hidden_by_user_id" uuid NOT NULL,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_hidden_seed_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_hidden_seed_templates" ADD CONSTRAINT "email_hidden_seed_templates_hidden_by_user_id_fkey" FOREIGN KEY ("hidden_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "email_hidden_seed_templates_organizer_select" ON "email_hidden_seed_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_organizer()));--> statement-breakpoint
CREATE POLICY "email_hidden_seed_templates_organizer_insert" ON "email_hidden_seed_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_organizer()));