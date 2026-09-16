-- This role is intentionally created without a password. Credentials must not
-- be committed to a migration; set the production password out of band after
-- this migration has run:
--
--   ALTER ROLE analytics_role PASSWORD '<secret>';
--
-- BYPASSRLS is required for whole-database analytics because every application
-- table currently has row-level security enabled. It bypasses row filtering,
-- but it does not grant INSERT, UPDATE, DELETE, TRUNCATE, or object ownership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'analytics_role'
  ) THEN
    CREATE ROLE analytics_role
      WITH LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      BYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
-- Reassert the security-sensitive attributes if the role survived a local
-- database reset. Do not mention PASSWORD here: an existing secret must stay
-- intact when migrations are replayed.
ALTER ROLE analytics_role
  WITH LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  BYPASSRLS;
--> statement-breakpoint
-- This is defense in depth for clients that honor their session defaults.
-- The object grants below, not this setting, enforce the no-write boundary.
ALTER ROLE analytics_role SET default_transaction_read_only = on;
--> statement-breakpoint
ALTER ROLE analytics_role SET search_path = public, pg_catalog;
--> statement-breakpoint
-- Remove any direct privileges left by a previous manual setup, then grant the
-- minimum needed to connect and query tables/views in public.
REVOKE ALL PRIVILEGES ON DATABASE postgres FROM analytics_role;
--> statement-breakpoint
GRANT CONNECT ON DATABASE postgres TO analytics_role;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SCHEMA public FROM analytics_role;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO analytics_role;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM analytics_role;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_role;
--> statement-breakpoint
-- Sequence privileges are unnecessary for analysis and UPDATE/USAGE can
-- advance sequences, so grant none.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM analytics_role;
--> statement-breakpoint
-- handle_new_user() runs with its owner's privileges. Trigger functions cannot
-- be called directly, but leaving PUBLIC EXECUTE in place would let an
-- untrusted login attach it to a temporary table and invoke it as a trigger.
-- The existing auth.users trigger continues to work after this revoke.
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user() FROM PUBLIC;
--> statement-breakpoint
-- Keep future objects created by the migration owner on the same allow-list.
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM analytics_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  IN SCHEMA public
  GRANT SELECT ON TABLES TO analytics_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM analytics_role;
--> statement-breakpoint
-- PostgreSQL grants PUBLIC execution on new routines by default. Remove that
-- global default so future SECURITY DEFINER helpers must name their callers,
-- as this repository's existing RLS helpers already do.
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  REVOKE EXECUTE ON ROUTINES FROM PUBLIC;
