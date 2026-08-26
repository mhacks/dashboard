-- Complete reservation management schema, preserving legacy assignments.

CREATE TABLE IF NOT EXISTS "public"."teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "teams_name_unique" UNIQUE ("name")
);

ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "team_id" uuid;

-- A partially upgraded database can already have user/team assignments.
INSERT INTO "public"."teams" ("id", "name")
SELECT DISTINCT
  "team_id",
  'Imported team ' || "team_id"::text
FROM "public"."users"
WHERE "team_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_reserved_by_team_id_teams_id_fk'
      AND conrelid = 'public.tables'::regclass
      AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE "public"."tables"
      DROP CONSTRAINT "tables_reserved_by_team_id_teams_id_fk";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_team_id_teams_id_fk'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE "public"."users"
      ADD CONSTRAINT "users_team_id_teams_id_fk"
      FOREIGN KEY ("team_id")
      REFERENCES "public"."teams" ("id")
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "users_team_id_idx"
  ON "public"."users" ("team_id");

-- Legacy reservations stored the team UUID without a teams foreign key.
-- Materialize those IDs before adding the constraint so no assignment is lost.
INSERT INTO "public"."teams" ("id", "name")
SELECT DISTINCT
  "reserved_by_team_id",
  'Imported team ' || "reserved_by_team_id"::text
FROM "public"."tables"
WHERE "reserved_by_team_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_event_id_events_id_fk'
      AND conrelid = 'public.tables'::regclass
  ) THEN
    ALTER TABLE "public"."tables"
      ADD CONSTRAINT "tables_event_id_events_id_fk"
      FOREIGN KEY ("event_id")
      REFERENCES "public"."events" ("id")
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_reserved_by_team_id_teams_id_fk'
      AND conrelid = 'public.tables'::regclass
  ) THEN
    ALTER TABLE "public"."tables"
      ADD CONSTRAINT "tables_reserved_by_team_id_teams_id_fk"
      FOREIGN KEY ("reserved_by_team_id")
      REFERENCES "public"."teams" ("id")
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_event_number_unique'
      AND conrelid = 'public.tables'::regclass
  ) THEN
    ALTER TABLE "public"."tables"
      ADD CONSTRAINT "tables_event_number_unique"
      UNIQUE ("event_id", "number");
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "tables_event_team_unique"
  ON "public"."tables" ("event_id", "reserved_by_team_id");
CREATE INDEX IF NOT EXISTS "tables_event_id_idx"
  ON "public"."tables" ("event_id");

UPDATE "public"."tables"
SET "reserved_at" = now()
WHERE "reserved_by_team_id" IS NOT NULL
  AND "reserved_at" IS NULL;

UPDATE "public"."tables"
SET "reserved_at" = NULL
WHERE "reserved_by_team_id" IS NULL
  AND "reserved_at" IS NOT NULL;

-- Older reservation data allowed zero and negative table numbers. Preserve each
-- table ID and assignment while deterministically filling the lowest available
-- positive number in its event before enforcing the positive-number check.
DO $$
DECLARE
  legacy_table record;
  replacement_number bigint;
BEGIN
  FOR legacy_table IN
    SELECT "id", "event_id", "number"
    FROM "public"."tables"
    WHERE "number" <= 0
    ORDER BY "event_id", "number", "id"
  LOOP
    SELECT min(candidate."number")
    INTO replacement_number
    FROM (
      SELECT 1::bigint AS "number"
      UNION
      SELECT existing."number"::bigint + 1
      FROM "public"."tables" AS existing
      WHERE existing."event_id" = legacy_table.event_id
        AND existing."number" > 0
        AND existing."number" < 2147483647
    ) AS candidate
    WHERE candidate."number" <= 2147483647
      AND NOT EXISTS (
        SELECT 1
        FROM "public"."tables" AS occupied
        WHERE occupied."event_id" = legacy_table.event_id
          AND occupied."number" = candidate."number"
      );

    IF replacement_number IS NULL THEN
      RAISE EXCEPTION
        'Cannot remap legacy table % for event %: no unused positive table number remains within PostgreSQL integer maximum 2147483647.',
        legacy_table.id,
        legacy_table.event_id;
    END IF;

    UPDATE "public"."tables"
    SET "number" = replacement_number::integer
    WHERE "id" = legacy_table.id;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_number_positive'
      AND conrelid = 'public.tables'::regclass
  ) THEN
    ALTER TABLE "public"."tables"
      ADD CONSTRAINT "tables_number_positive"
      CHECK ("number" > 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_reservation_timestamp_consistent'
      AND conrelid = 'public.tables'::regclass
  ) THEN
    ALTER TABLE "public"."tables"
      ADD CONSTRAINT "tables_reservation_timestamp_consistent"
      CHECK (
        ("reserved_by_team_id" IS NULL) =
        ("reserved_at" IS NULL)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
    WHERE pg_namespace.nspname = 'public'
      AND pg_type.typname = 'reservation_event_status'
  ) THEN
    CREATE TYPE "public"."reservation_event_status"
      AS ENUM ('draft', 'open', 'closed', 'archived');
  END IF;
END
$$;

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "status"
    "public"."reservation_event_status" DEFAULT 'draft' NOT NULL;
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "reservations_open_at" timestamp with time zone;
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "reservations_close_at" timestamp with time zone;
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "updated_at"
    timestamp with time zone DEFAULT now() NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_reservation_window_valid'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE "public"."events"
      ADD CONSTRAINT "events_reservation_window_valid"
      CHECK (
        "reservations_open_at" IS NULL
        OR "reservations_close_at" IS NULL
        OR "reservations_close_at" > "reservations_open_at"
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "events_status_starts_at_idx"
  ON "public"."events" ("status", "starts_at");

CREATE TABLE IF NOT EXISTS "public"."reservation_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid,
  "event_name" text NOT NULL,
  "actor_user_id" uuid,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reservation_audit_log_event_id_events_id_fk"
    FOREIGN KEY ("event_id")
    REFERENCES "public"."events" ("id")
    ON DELETE SET NULL,
  CONSTRAINT "reservation_audit_log_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id")
    REFERENCES "public"."users" ("id")
    ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservation_audit_log_event_id_events_id_fk'
      AND conrelid = 'public.reservation_audit_log'::regclass
  ) THEN
    ALTER TABLE "public"."reservation_audit_log"
      ADD CONSTRAINT "reservation_audit_log_event_id_events_id_fk"
      FOREIGN KEY ("event_id")
      REFERENCES "public"."events" ("id")
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservation_audit_log_actor_user_id_users_id_fk'
      AND conrelid = 'public.reservation_audit_log'::regclass
  ) THEN
    ALTER TABLE "public"."reservation_audit_log"
      ADD CONSTRAINT "reservation_audit_log_actor_user_id_users_id_fk"
      FOREIGN KEY ("actor_user_id")
      REFERENCES "public"."users" ("id")
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "reservation_audit_event_created_at_idx"
  ON "public"."reservation_audit_log" ("event_id", "created_at");
CREATE INDEX IF NOT EXISTS "reservation_audit_created_at_idx"
  ON "public"."reservation_audit_log" ("created_at");

CREATE OR REPLACE FUNCTION "public"."enforce_reservation_audit_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND pg_trigger_depth() > 1
    AND (
      (
        OLD.event_id IS NOT NULL
        AND NEW.event_id IS NULL
        AND NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
      )
      OR (
        OLD.actor_user_id IS NOT NULL
        AND NEW.actor_user_id IS NULL
        AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id
      )
    )
    AND ROW(
      NEW.id,
      NEW.event_name,
      NEW.actor_email,
      NEW.action,
      NEW.entity_type,
      NEW.entity_id,
      NEW.details,
      NEW.created_at
    ) IS NOT DISTINCT FROM ROW(
      OLD.id,
      OLD.event_name,
      OLD.actor_email,
      OLD.action,
      OLD.entity_type,
      OLD.entity_id,
      OLD.details,
      OLD.created_at
    )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'reservation_audit_log is append-only'
    USING ERRCODE = '55000';
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'reservation_audit_log_append_only'
      AND tgrelid = 'public.reservation_audit_log'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER "reservation_audit_log_append_only"
      BEFORE UPDATE OR DELETE
      ON "public"."reservation_audit_log"
      FOR EACH ROW
      EXECUTE FUNCTION "public"."enforce_reservation_audit_append_only"();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'reservation_audit_log_append_only_truncate'
      AND tgrelid = 'public.reservation_audit_log'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER "reservation_audit_log_append_only_truncate"
      BEFORE TRUNCATE
      ON "public"."reservation_audit_log"
      FOR EACH STATEMENT
      EXECUTE FUNCTION "public"."enforce_reservation_audit_append_only"();
  END IF;
END
$$;

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservation_audit_log" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE
  "public"."teams",
  "public"."events",
  "public"."tables",
  "public"."reservation_audit_log"
TO authenticated;

DROP POLICY IF EXISTS "teams_select_authenticated" ON "public"."teams";
CREATE POLICY "teams_select_authenticated"
  ON "public"."teams"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "events_select_visible_or_organizer" ON "public"."events";
CREATE POLICY "events_select_visible_or_organizer"
  ON "public"."events"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    "public"."is_organizer"()
    OR "events"."status" IN ('open', 'closed')
  );

DROP POLICY IF EXISTS "tables_select_visible_or_organizer" ON "public"."tables";
CREATE POLICY "tables_select_visible_or_organizer"
  ON "public"."tables"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    "public"."is_organizer"()
    OR EXISTS (
      SELECT 1
      FROM "public"."events"
      WHERE "events"."id" = "tables"."event_id"
        AND "events"."status" IN ('open', 'closed')
    )
  );

DROP POLICY IF EXISTS "reservation_audit_select_organizer"
  ON "public"."reservation_audit_log";
CREATE POLICY "reservation_audit_select_organizer"
  ON "public"."reservation_audit_log"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ("public"."is_organizer"());
