-- Table reservation system: teams, judging events, and per-event table slots.

CREATE TABLE IF NOT EXISTS "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "teams_name_unique" UNIQUE("name")
);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "team_id" uuid,
  ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;

ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_team_id_teams_id_fk";
ALTER TABLE "users"
  ADD CONSTRAINT "users_team_id_teams_id_fk"
  FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "starts_at" timestamp with time zone,
  "location" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "number" integer NOT NULL,
  "reserved_by_team_id" uuid,
  "reserved_at" timestamp with time zone,
  CONSTRAINT "tables_event_number_unique" UNIQUE("event_id", "number")
);

ALTER TABLE "tables"
  DROP CONSTRAINT IF EXISTS "tables_event_id_events_id_fk";
ALTER TABLE "tables"
  ADD CONSTRAINT "tables_event_id_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "tables"
  DROP CONSTRAINT IF EXISTS "tables_reserved_by_team_id_teams_id_fk";
ALTER TABLE "tables"
  ADD CONSTRAINT "tables_reserved_by_team_id_teams_id_fk"
  FOREIGN KEY ("reserved_by_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "tables_event_team_unique"
  ON "tables" ("event_id", "reserved_by_team_id");
