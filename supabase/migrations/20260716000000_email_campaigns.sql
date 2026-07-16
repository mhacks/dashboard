CREATE TYPE "public"."email_template_type" AS ENUM('structured', 'html');
CREATE TYPE "public"."email_campaign_status" AS ENUM('draft', 'ready', 'sending', 'sent', 'failed', 'cancelled');
CREATE TYPE "public"."email_recipient_status" AS ENUM('pending', 'sent', 'failed', 'skipped');

CREATE TABLE "public"."email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "type" "public"."email_template_type" NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "subject" text NOT NULL,
  "preview_text" text DEFAULT '' NOT NULL,
  "content" jsonb,
  "html" text,
  "theme_snapshot" jsonb,
  "status" text DEFAULT 'active' NOT NULL,
  "source_template_id" text DEFAULT 'mhacks-announcement' NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."email_theme_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "theme" jsonb NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "template_id" uuid,
  "template_snapshot" jsonb NOT NULL,
  "theme_snapshot" jsonb,
  "status" "public"."email_campaign_status" DEFAULT 'draft' NOT NULL,
  "subject" text NOT NULL,
  "preview_text" text DEFAULT '' NOT NULL,
  "total_recipients" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "is_direct_send" boolean DEFAULT false NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."email_campaign_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "email" text NOT NULL,
  "merge_data" jsonb NOT NULL,
  "status" "public"."email_recipient_status" DEFAULT 'pending' NOT NULL,
  "message_id" text,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_campaign_recipients_campaign_email_unique" UNIQUE("campaign_id", "email")
);

CREATE TABLE "public"."email_campaign_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid,
  "actor_user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "details" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."email_templates"
  ADD CONSTRAINT "email_templates_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."email_templates"
  ADD CONSTRAINT "email_templates_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."email_theme_settings"
  ADD CONSTRAINT "email_theme_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."email_campaigns"
  ADD CONSTRAINT "email_campaigns_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "public"."email_campaigns"
  ADD CONSTRAINT "email_campaigns_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."email_campaigns"
  ADD CONSTRAINT "email_campaigns_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."email_campaign_recipients"
  ADD CONSTRAINT "email_campaign_recipients_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."email_campaign_events"
  ADD CONSTRAINT "email_campaign_events_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."email_campaign_events"
  ADD CONSTRAINT "email_campaign_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX "email_templates_updated_at_idx" ON "public"."email_templates" USING btree ("updated_at");
CREATE INDEX "email_campaigns_created_at_idx" ON "public"."email_campaigns" USING btree ("created_at");
CREATE INDEX "email_campaign_recipients_campaign_status_idx" ON "public"."email_campaign_recipients" USING btree ("campaign_id", "status");
CREATE INDEX "email_campaign_events_campaign_created_at_idx" ON "public"."email_campaign_events" USING btree ("campaign_id", "created_at");

ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_theme_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_campaign_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_campaign_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_organizer_select" ON "public"."email_templates"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_organizer());
CREATE POLICY "email_templates_organizer_insert" ON "public"."email_templates"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer());
CREATE POLICY "email_templates_organizer_update" ON "public"."email_templates"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());
CREATE POLICY "email_templates_organizer_delete" ON "public"."email_templates"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_organizer());

CREATE POLICY "email_theme_settings_organizer_select" ON "public"."email_theme_settings"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_organizer());
CREATE POLICY "email_theme_settings_organizer_insert" ON "public"."email_theme_settings"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer());
CREATE POLICY "email_theme_settings_organizer_update" ON "public"."email_theme_settings"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());

CREATE POLICY "email_campaigns_organizer_select" ON "public"."email_campaigns"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_organizer());
CREATE POLICY "email_campaigns_organizer_insert" ON "public"."email_campaigns"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer());
CREATE POLICY "email_campaigns_organizer_update" ON "public"."email_campaigns"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());
CREATE POLICY "email_campaigns_organizer_delete" ON "public"."email_campaigns"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_organizer());

CREATE POLICY "email_campaign_recipients_organizer_select" ON "public"."email_campaign_recipients"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_organizer());
CREATE POLICY "email_campaign_recipients_organizer_insert" ON "public"."email_campaign_recipients"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer());
CREATE POLICY "email_campaign_recipients_organizer_update" ON "public"."email_campaign_recipients"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());
CREATE POLICY "email_campaign_recipients_organizer_delete" ON "public"."email_campaign_recipients"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_organizer());

CREATE POLICY "email_campaign_events_organizer_select" ON "public"."email_campaign_events"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_organizer());
CREATE POLICY "email_campaign_events_organizer_insert" ON "public"."email_campaign_events"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer());
