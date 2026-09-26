-- A direct-login role used only by the Slack reporting bot.
--
-- SECURITY: The password below is a temporary bootstrap credential requested
-- for initial deployment. Rotate it on Supabase immediately after the migration
-- runs. It appears only in CREATE ROLE, so replaying this migration when the
-- role already exists will not restore the committed password.
--
-- The bot deliberately has no direct access to application tables and does not
-- bypass RLS. Four curated, prefixed views in public are its complete data
-- boundary. Keep future bot data additions in those views instead of granting
-- table access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'analytics_role'
  ) THEN
    CREATE ROLE analytics_role
      WITH LOGIN
      PASSWORD '(<KODlCEjy[w[e1!{n[Ijn-myeFMt@oS'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS
      CONNECTION LIMIT 3;
  END IF;
END
$$;
--> statement-breakpoint
-- Reassert every security-sensitive attribute without touching an existing
-- password. A stolen bot credential cannot create roles/databases, replicate,
-- bypass RLS, or fan out enough sessions to exhaust the database.
ALTER ROLE analytics_role
  WITH LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 3;
--> statement-breakpoint
-- NOINHERIT does not stop SET ROLE. Remove memberships in both directions so
-- the bot cannot assume another role and no other login inherits bot access.
DO $$
DECLARE
  membership record;
BEGIN
  FOR membership IN
    SELECT
      granted_role.rolname AS granted_role,
      member_role.rolname AS member_role
    FROM pg_catalog.pg_auth_members AS role_membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = role_membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = role_membership.member
    WHERE granted_role.rolname = 'analytics_role'
       OR member_role.rolname = 'analytics_role'
  LOOP
    EXECUTE format(
      'REVOKE %I FROM %I',
      membership.granted_role,
      membership.member_role
    );
  END LOOP;
END
$$;
--> statement-breakpoint
-- Refuse to silently adopt a manually created role that owns database objects.
-- Ownership would bypass the grants below and make the role effectively
-- writable even after every explicit privilege was revoked.
DO $$
DECLARE
  analytics_role_oid oid;
BEGIN
  SELECT oid
  INTO STRICT analytics_role_oid
  FROM pg_catalog.pg_roles
  WHERE rolname = 'analytics_role';

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class WHERE relowner = analytics_role_oid
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_proc WHERE proowner = analytics_role_oid
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner = analytics_role_oid
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_type WHERE typowner = analytics_role_oid
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_database WHERE datdba = analytics_role_oid
  ) THEN
    RAISE EXCEPTION
      'analytics_role owns database objects; transfer ownership before applying this migration';
  END IF;
END
$$;
--> statement-breakpoint
-- Session settings are defense in depth. Object privileges and the curated
-- views below remain the actual authorization boundary.
ALTER ROLE analytics_role SET default_transaction_read_only = on;
--> statement-breakpoint
ALTER ROLE analytics_role SET statement_timeout = '30s';
--> statement-breakpoint
ALTER ROLE analytics_role SET lock_timeout = '5s';
--> statement-breakpoint
ALTER ROLE analytics_role SET idle_in_transaction_session_timeout = '30s';
--> statement-breakpoint
ALTER ROLE analytics_role SET search_path = pg_catalog, public;
--> statement-breakpoint
-- Remove every legacy/manual direct grant before adding back the minimum
-- privileges required by the four reporting views.
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
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM analytics_role;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public FROM analytics_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  REVOKE ALL PRIVILEGES ON TABLES FROM analytics_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM analytics_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  REVOKE ALL PRIVILEGES ON ROUTINES FROM analytics_role;
--> statement-breakpoint
-- This SECURITY DEFINER trigger predates the repository's explicit function
-- grants. Removing PUBLIC execution prevents any untrusted login from attaching
-- it to a temporary table and causing writes with the owner's privileges.
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user() FROM PUBLIC;
--> statement-breakpoint
-- PostgreSQL grants PUBLIC execution on new routines by default. Future
-- SECURITY DEFINER helpers must explicitly name their callers.
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  REVOKE EXECUTE ON ROUTINES FROM PUBLIC;
--> statement-breakpoint
-- These owner-permission views are the intentional reporting boundary: the bot
-- can query their projected columns without any grant on the base tables. The
-- security barrier prevents caller-supplied predicates from being pushed below
-- the view boundary. Submitted applicants only; phone numbers, demographics,
-- essays, resumes, allergies, and social profiles are intentionally absent.
CREATE VIEW public.slack_analytics_applicants
  WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  applicant.id AS application_id,
  applicant.user_id,
  account.email,
  account.role,
  applicant.first_name,
  applicant.last_name,
  applicant.status AS application_status,
  applicant.decision,
  applicant.university,
  applicant.country,
  applicant.degree,
  applicant.graduation_year,
  applicant.previous_hackathons,
  applicant.major,
  applicant.transportation_type,
  applicant.coming_from,
  applicant.needs_travel_reimbursement,
  applicant.would_attend_without_reimbursement,
  applicant.airport_code,
  applicant.created_at AS applied_at,
  applicant.updated_at
FROM public.hacker_applicants AS applicant
JOIN public.users AS account
  ON account.id = applicant.user_id;
--> statement-breakpoint
-- RSVP reporting excludes street/postal addresses, receipt object keys and
-- filenames, waivers, and free-form notes.
CREATE VIEW public.slack_analytics_rsvps
  WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  rsvp.id AS rsvp_id,
  rsvp.user_id,
  rsvp.application_id,
  account.email,
  applicant.first_name,
  applicant.last_name,
  applicant.decision,
  rsvp.travel_plan,
  rsvp.travel_guide_acknowledged,
  rsvp.flight_booked,
  rsvp.country,
  rsvp.submitted_at
FROM public.hacker_rsvps AS rsvp
JOIN public.users AS account
  ON account.id = rsvp.user_id
JOIN public.hacker_applicants AS applicant
  ON applicant.id = rsvp.application_id;
--> statement-breakpoint
-- Successful attendance records only; the raw scanner audit log is not
-- exposed because it can contain arbitrary scanned text.
CREATE VIEW public.slack_analytics_event_checkins
  WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  checkin.id AS checkin_id,
  checkin.event_id,
  event.slug AS event_slug,
  event.name AS event_name,
  event.location AS event_location,
  event.starts_at,
  event.ends_at,
  checkin.user_id,
  account.email,
  applicant.first_name,
  applicant.last_name,
  checkin.checked_in_at,
  checkin.method
FROM public.event_checkins AS checkin
JOIN public.events AS event
  ON event.id = checkin.event_id
JOIN public.users AS account
  ON account.id = checkin.user_id
LEFT JOIN public.hacker_applicants AS applicant
  ON applicant.user_id = checkin.user_id;
--> statement-breakpoint
CREATE VIEW public.slack_analytics_team_members
  WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  team.id AS team_id,
  team.name AS team_name,
  membership.user_id,
  account.email,
  applicant.first_name,
  applicant.last_name,
  membership.joined_at,
  team.created_at AS team_created_at
FROM public.team_members AS membership
JOIN public.teams AS team
  ON team.id = membership.team_id
JOIN public.users AS account
  ON account.id = membership.user_id
LEFT JOIN public.hacker_applicants AS applicant
  ON applicant.user_id = membership.user_id;
--> statement-breakpoint
-- public is exposed through Supabase's Data API. Revoke the views from every
-- API role explicitly, then grant only the direct-login bot role.
REVOKE ALL PRIVILEGES ON
  public.slack_analytics_applicants,
  public.slack_analytics_rsvps,
  public.slack_analytics_event_checkins,
  public.slack_analytics_team_members
FROM PUBLIC, anon, authenticated, service_role, analytics_role;
--> statement-breakpoint
GRANT SELECT ON
  public.slack_analytics_applicants,
  public.slack_analytics_rsvps,
  public.slack_analytics_event_checkins,
  public.slack_analytics_team_members
TO analytics_role;
--> statement-breakpoint
COMMENT ON ROLE analytics_role IS
  'Read-only Slack reporting bot; access is limited to public.slack_analytics_* views.';
--> statement-breakpoint
-- Fail the migration if later edits restore writes, unapproved SELECT access,
-- or callable public SECURITY DEFINER routines.
DO $$
BEGIN
  IF has_schema_privilege('analytics_role', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'analytics_role unexpectedly has CREATE on schema public';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (
        has_table_privilege(
          'analytics_role',
          relation.oid,
          'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        )
        OR has_any_column_privilege(
          'analytics_role',
          relation.oid,
          'INSERT,UPDATE,REFERENCES'
        )
      )
  ) THEN
    RAISE EXCEPTION 'analytics_role unexpectedly has write access to public relations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND relation.relname NOT IN (
        'slack_analytics_applicants',
        'slack_analytics_rsvps',
        'slack_analytics_event_checkins',
        'slack_analytics_team_members'
      )
      AND has_any_column_privilege('analytics_role', relation.oid, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'analytics_role unexpectedly has SELECT on an unapproved public relation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS sequence
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = sequence.relnamespace
    WHERE namespace.nspname = 'public'
      AND sequence.relkind = 'S'
      AND has_sequence_privilege(
        'analytics_role',
        sequence.oid,
        'USAGE,SELECT,UPDATE'
      )
  ) THEN
    RAISE EXCEPTION 'analytics_role unexpectedly has access to public sequences';
  END IF;

  IF NOT (
    has_table_privilege('analytics_role', 'public.slack_analytics_applicants', 'SELECT')
    AND has_table_privilege('analytics_role', 'public.slack_analytics_rsvps', 'SELECT')
    AND has_table_privilege('analytics_role', 'public.slack_analytics_event_checkins', 'SELECT')
    AND has_table_privilege('analytics_role', 'public.slack_analytics_team_members', 'SELECT')
  ) THEN
    RAISE EXCEPTION 'analytics_role is missing SELECT on an approved Slack analytics view';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = 'public'
      AND routine.prosecdef
      AND has_function_privilege('analytics_role', routine.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION
      'analytics_role unexpectedly has EXECUTE on a public SECURITY DEFINER routine';
  END IF;
END
$$;
