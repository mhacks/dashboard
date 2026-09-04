import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl
  ? postgres(databaseUrl, { max: 1, prepare: false })
  : null;

const requiredTables = [
  "teams",
  "events",
  "tables",
  "reservation_audit_log",
] as const;
const requiredColumns = [
  ["users", "team_id"],
  ["events", "status"],
  ["events", "reservations_open_at"],
  ["events", "reservations_close_at"],
  ["events", "updated_at"],
] as const;
const requiredConstraints = [
  "users_team_id_teams_id_fk",
  "tables_event_id_events_id_fk",
  "tables_reserved_by_team_id_teams_id_fk",
  "tables_event_number_unique",
  "tables_number_positive",
  "tables_reservation_timestamp_consistent",
  "events_reservation_window_valid",
  "reservation_audit_log_event_id_events_id_fk",
  "reservation_audit_log_actor_user_id_users_id_fk",
] as const;
const requiredPolicies = [
  "teams_select_authenticated",
  "events_select_visible_or_organizer",
  "tables_select_visible_or_organizer",
  "reservation_audit_select_organizer",
] as const;
const requiredIndexes = [
  "users_team_id_idx",
  "events_status_starts_at_idx",
  "tables_event_id_idx",
  "reservation_audit_event_created_at_idx",
  "reservation_audit_created_at_idx",
] as const;

const upgradeFixtureTables = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    teamId: "40000000-0000-4000-8000-000000000002",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    teamId: "40000000-0000-4000-8000-000000000004",
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    teamId: "40000000-0000-4000-8000-000000000006",
  },
] as const;
const upgradeFixtureMarker = "reservation-management-upgrade-fixture-v1";
const rlsFixture = {
  organizerUserId: "50000000-0000-4000-8000-000000000001",
  hackerUserId: "50000000-0000-4000-8000-000000000002",
  eventIds: {
    draft: "51000000-0000-4000-8000-000000000001",
    open: "51000000-0000-4000-8000-000000000002",
    closed: "51000000-0000-4000-8000-000000000003",
    archived: "51000000-0000-4000-8000-000000000004",
  },
  auditId: "53000000-0000-4000-8000-000000000001",
} as const;

describe.skipIf(!databaseUrl)("reservation management database schema", () => {
  beforeAll(async () => {
    if (!database) {
      return;
    }

    await database`
      INSERT INTO public.users (id, email, role)
      VALUES
        (
          ${rlsFixture.organizerUserId}::uuid,
          'reservation-rls-organizer@mhacks.test',
          'organizer'
        ),
        (
          ${rlsFixture.hackerUserId}::uuid,
          'reservation-rls-hacker@mhacks.test',
          'hacker'
        )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role
    `;
    await database`
      INSERT INTO public.events (id, name, status)
      VALUES
        (${rlsFixture.eventIds.draft}::uuid, 'RLS draft', 'draft'),
        (${rlsFixture.eventIds.open}::uuid, 'RLS open', 'open'),
        (${rlsFixture.eventIds.closed}::uuid, 'RLS closed', 'closed'),
        (${rlsFixture.eventIds.archived}::uuid, 'RLS archived', 'archived')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status
    `;
    await database`
      INSERT INTO public.tables (id, event_id, number)
      VALUES
        (
          '52000000-0000-4000-8000-000000000001',
          ${rlsFixture.eventIds.draft}::uuid,
          1
        ),
        (
          '52000000-0000-4000-8000-000000000002',
          ${rlsFixture.eventIds.open}::uuid,
          2
        ),
        (
          '52000000-0000-4000-8000-000000000003',
          ${rlsFixture.eventIds.closed}::uuid,
          3
        ),
        (
          '52000000-0000-4000-8000-000000000004',
          ${rlsFixture.eventIds.archived}::uuid,
          4
        )
      ON CONFLICT (id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        number = EXCLUDED.number
    `;
    await database`
      INSERT INTO public.reservation_audit_log (
        id,
        event_id,
        event_name,
        actor_user_id,
        actor_email,
        action,
        entity_type
      )
      VALUES (
        ${rlsFixture.auditId}::uuid,
        ${rlsFixture.eventIds.draft}::uuid,
        'RLS draft',
        ${rlsFixture.organizerUserId}::uuid,
        'reservation-rls-organizer@mhacks.test',
        'rls.test',
        'event'
      )
      ON CONFLICT (id) DO NOTHING
    `;
  });

  afterAll(async () => {
    await database?.end({ timeout: 5 });
  });

  test("contains the complete reservation schema", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const tableRows = await database<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const tableNames = new Set(tableRows.map((row) => row.table_name));
    expect(
      requiredTables.filter((tableName) => !tableNames.has(tableName)),
      "missing reservation tables",
    ).toEqual([]);

    const columnRows = await database<
      { table_name: string; column_name: string }[]
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    const columnNames = new Set(
      columnRows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    expect(
      requiredColumns
        .map(([tableName, columnName]) => `${tableName}.${columnName}`)
        .filter((columnName) => !columnNames.has(columnName)),
      "missing reservation columns",
    ).toEqual([]);
    expect(columnNames.has("users.is_admin")).toBe(false);

    const constraintRows = await database<{ constraint_name: string }[]>`
      SELECT catalog_constraint.conname AS constraint_name
      FROM pg_constraint AS catalog_constraint
      JOIN pg_namespace AS namespace
        ON namespace.oid = catalog_constraint.connamespace
      WHERE namespace.nspname = 'public'
    `;
    const constraintNames = new Set(
      constraintRows.map((row) => row.constraint_name),
    );
    expect(
      requiredConstraints.filter(
        (constraintName) => !constraintNames.has(constraintName),
      ),
      "missing reservation constraints",
    ).toEqual([]);
    const [assignmentForeignKey] = await database<{ delete_action: string }[]>`
      SELECT catalog_constraint.confdeltype AS delete_action
      FROM pg_constraint AS catalog_constraint
      WHERE catalog_constraint.conname = 'tables_reserved_by_team_id_teams_id_fk'
        AND catalog_constraint.conrelid = 'public.tables'::regclass
    `;
    expect(assignmentForeignKey.delete_action).toBe("r");

    const indexRows = await database<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const indexNames = new Set(indexRows.map((row) => row.indexname));
    expect(
      requiredIndexes.filter((indexName) => !indexNames.has(indexName)),
      "missing reservation indexes",
    ).toEqual([]);

    const policyRows = await database<
      { policyname: string; tablename: string; cmd: string }[]
    >`
      SELECT policyname, tablename, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY (
          ARRAY['teams', 'events', 'tables', 'reservation_audit_log']
        )
    `;
    const policyNames = new Set(policyRows.map((row) => row.policyname));
    expect(
      requiredPolicies.filter((policyName) => !policyNames.has(policyName)),
      "missing reservation policies",
    ).toEqual([]);
    expect(policyRows.every((row) => row.cmd === "SELECT")).toBe(true);

    const rlsRows = await database<
      { table_name: string; rls_enabled: boolean }[]
    >`
      SELECT class.relname AS table_name, class.relrowsecurity AS rls_enabled
      FROM pg_class AS class
      JOIN pg_namespace AS namespace
        ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND class.relname = ANY (
          ARRAY['teams', 'events', 'tables', 'reservation_audit_log']
        )
        AND class.relkind = 'r'
    `;
    const rlsByTable = new Map(
      rlsRows.map((row) => [row.table_name, row.rls_enabled]),
    );
    expect(
      requiredTables.filter((tableName) => rlsByTable.get(tableName) !== true),
      "reservation tables without RLS",
    ).toEqual([]);

    const enumRows = await database<{ enum_value: string }[]>`
      SELECT enum.enumlabel AS enum_value
      FROM pg_enum AS enum
      JOIN pg_type AS type
        ON type.oid = enum.enumtypid
      JOIN pg_namespace AS namespace
        ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'public'
        AND type.typname = 'reservation_event_status'
      ORDER BY enum.enumsortorder
    `;
    expect(enumRows.map((row) => row.enum_value)).toEqual([
      "draft",
      "open",
      "closed",
      "archived",
    ]);
  });

  test("organizers can read all reservation records without recursive RLS", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const result = await database.begin(async (transaction) => {
      await transaction`
        SELECT set_config(
          'request.jwt.claim.sub',
          ${rlsFixture.organizerUserId},
          true
        )
      `;
      await transaction`SET LOCAL ROLE authenticated`;

      const eventRows = await transaction<{ status: string }[]>`
        SELECT status::text
        FROM public.events
        WHERE id = ANY (
          ARRAY[
            ${rlsFixture.eventIds.draft}::uuid,
            ${rlsFixture.eventIds.open}::uuid,
            ${rlsFixture.eventIds.closed}::uuid,
            ${rlsFixture.eventIds.archived}::uuid
          ]
        )
        ORDER BY status
      `;
      const tableRows = await transaction<{ number: number }[]>`
        SELECT number
        FROM public.tables
        WHERE event_id = ANY (
          ARRAY[
            ${rlsFixture.eventIds.draft}::uuid,
            ${rlsFixture.eventIds.open}::uuid,
            ${rlsFixture.eventIds.closed}::uuid,
            ${rlsFixture.eventIds.archived}::uuid
          ]
        )
        ORDER BY number
      `;
      const auditRows = await transaction<{ id: string }[]>`
        SELECT id::text
        FROM public.reservation_audit_log
        WHERE id = ${rlsFixture.auditId}::uuid
      `;

      return { eventRows, tableRows, auditRows };
    });

    expect(result.eventRows.map((row) => row.status)).toEqual([
      "archived",
      "closed",
      "draft",
      "open",
    ]);
    expect(result.tableRows.map((row) => row.number)).toEqual([1, 2, 3, 4]);
    expect(result.auditRows).toEqual([{ id: rlsFixture.auditId }]);
  });

  test("hackers can read only participant-visible reservation records", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const result = await database.begin(async (transaction) => {
      await transaction`
        SELECT set_config(
          'request.jwt.claim.sub',
          ${rlsFixture.hackerUserId},
          true
        )
      `;
      await transaction`SET LOCAL ROLE authenticated`;

      const eventRows = await transaction<{ status: string }[]>`
        SELECT status::text
        FROM public.events
        WHERE id = ANY (
          ARRAY[
            ${rlsFixture.eventIds.draft}::uuid,
            ${rlsFixture.eventIds.open}::uuid,
            ${rlsFixture.eventIds.closed}::uuid,
            ${rlsFixture.eventIds.archived}::uuid
          ]
        )
        ORDER BY status
      `;
      const tableRows = await transaction<{ number: number }[]>`
        SELECT number
        FROM public.tables
        WHERE event_id = ANY (
          ARRAY[
            ${rlsFixture.eventIds.draft}::uuid,
            ${rlsFixture.eventIds.open}::uuid,
            ${rlsFixture.eventIds.closed}::uuid,
            ${rlsFixture.eventIds.archived}::uuid
          ]
        )
        ORDER BY number
      `;
      const auditRows = await transaction<{ id: string }[]>`
        SELECT id::text
        FROM public.reservation_audit_log
        WHERE id = ${rlsFixture.auditId}::uuid
      `;

      return { eventRows, tableRows, auditRows };
    });

    expect(result.eventRows.map((row) => row.status)).toEqual([
      "closed",
      "open",
    ]);
    expect(result.tableRows.map((row) => row.number)).toEqual([2, 3]);
    expect(result.auditRows).toEqual([]);
  });

  test("rejects direct audit updates and deletes from privileged writers", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const auditId = randomUUID();
    await database`
      INSERT INTO public.reservation_audit_log (
        id,
        event_name,
        actor_email,
        action,
        entity_type
      )
      VALUES (
        ${auditId}::uuid,
        'Append-only test',
        'server@mhacks.test',
        'audit.created',
        'event'
      )
    `;

    await expect(
      database`
        UPDATE public.reservation_audit_log
        SET action = 'audit.mutated'
        WHERE id = ${auditId}::uuid
      `,
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      database`
        DELETE FROM public.reservation_audit_log
        WHERE id = ${auditId}::uuid
      `,
    ).rejects.toMatchObject({ code: "55000" });
  });

  test("rejects privileged audit truncation without losing rows", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const auditId = randomUUID();
    await database`
      INSERT INTO public.reservation_audit_log (
        id,
        event_name,
        actor_email,
        action,
        entity_type
      )
      VALUES (
        ${auditId}::uuid,
        'Truncate test',
        'server@mhacks.test',
        'audit.created',
        'event'
      )
    `;

    const truncateSucceededSentinel = new Error(
      "reservation audit TRUNCATE unexpectedly succeeded",
    );
    let truncateError: unknown;
    try {
      await database.begin(async (transaction) => {
        await transaction`TRUNCATE TABLE public.reservation_audit_log`;
        throw truncateSucceededSentinel;
      });
    } catch (error) {
      truncateError = error;
    }

    expect(truncateError).not.toBe(truncateSucceededSentinel);
    expect(truncateError).toMatchObject({ code: "55000" });

    const retainedRows = await database<{ id: string }[]>`
      SELECT id::text
      FROM public.reservation_audit_log
      WHERE id = ${auditId}::uuid
    `;
    expect(retainedRows).toEqual([{ id: auditId }]);
  });

  test("allows audit foreign keys to be nulled by referenced-row deletion", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const eventId = randomUUID();
    const actorUserId = randomUUID();
    const auditId = randomUUID();

    await database`
      INSERT INTO public.users (id, email, role)
      VALUES (
        ${actorUserId}::uuid,
        ${`audit-fk-${actorUserId}@mhacks.test`},
        'organizer'
      )
    `;
    await database`
      INSERT INTO public.events (id, name, status)
      VALUES (${eventId}::uuid, 'Audit FK test', 'draft')
    `;
    await database`
      INSERT INTO public.reservation_audit_log (
        id,
        event_id,
        event_name,
        actor_user_id,
        actor_email,
        action,
        entity_type
      )
      VALUES (
        ${auditId}::uuid,
        ${eventId}::uuid,
        'Audit FK test',
        ${actorUserId}::uuid,
        ${`audit-fk-${actorUserId}@mhacks.test`},
        'audit.created',
        'event'
      )
    `;

    await database`DELETE FROM public.events WHERE id = ${eventId}::uuid`;
    const afterEventDelete = await database<
      { event_id: string | null; actor_user_id: string | null }[]
    >`
      SELECT event_id::text, actor_user_id::text
      FROM public.reservation_audit_log
      WHERE id = ${auditId}::uuid
    `;
    expect(afterEventDelete).toEqual([
      { event_id: null, actor_user_id: actorUserId },
    ]);

    await database`DELETE FROM public.users WHERE id = ${actorUserId}::uuid`;
    const afterActorDelete = await database<
      { event_id: string | null; actor_user_id: string | null }[]
    >`
      SELECT event_id::text, actor_user_id::text
      FROM public.reservation_audit_log
      WHERE id = ${auditId}::uuid
    `;
    expect(afterActorDelete).toEqual([{ event_id: null, actor_user_id: null }]);
  });

  test("restricts assigned-team deletion but allows unassigned-team deletion", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const eventId = randomUUID();
    const tableId = randomUUID();
    const assignedTeamId = randomUUID();
    const unassignedTeamId = randomUUID();
    try {
      await database`
        INSERT INTO public.teams (id, name)
        VALUES
          (${assignedTeamId}::uuid, ${`Assigned delete ${assignedTeamId}`}),
          (${unassignedTeamId}::uuid, ${`Unassigned delete ${unassignedTeamId}`})
      `;
      await database`
        INSERT INTO public.events (id, name, status)
        VALUES (${eventId}::uuid, 'Team delete behavior', 'draft')
      `;
      await database`
        INSERT INTO public.tables (
          id,
          event_id,
          number,
          reserved_by_team_id,
          reserved_at
        )
        VALUES (
          ${tableId}::uuid,
          ${eventId}::uuid,
          1,
          ${assignedTeamId}::uuid,
          now()
        )
      `;

      await expect(
        database`DELETE FROM public.teams WHERE id = ${assignedTeamId}::uuid`,
      ).rejects.toMatchObject({ code: "23503" });
      await database`
        DELETE FROM public.teams
        WHERE id = ${unassignedTeamId}::uuid
      `;

      const assignedRows = await database<
        { reserved_by_team_id: string; reserved_at: Date }[]
      >`
        SELECT reserved_by_team_id::text, reserved_at
        FROM public.tables
        WHERE id = ${tableId}::uuid
      `;
      expect(assignedRows).toEqual([
        {
          reserved_by_team_id: assignedTeamId,
          reserved_at: expect.any(Date),
        },
      ]);
      const unassignedRows = await database<{ id: string }[]>`
        SELECT id::text
        FROM public.teams
        WHERE id = ${unassignedTeamId}::uuid
      `;
      expect(unassignedRows).toEqual([]);
    } finally {
      await database`DELETE FROM public.events WHERE id = ${eventId}::uuid`;
      await database`
        DELETE FROM public.teams
        WHERE id IN (${assignedTeamId}::uuid, ${unassignedTeamId}::uuid)
      `;
    }
  });

  test("remaps non-positive legacy numbers while preserving assignments", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }

    const [markerTable] = await database<{ exists: boolean }[]>`
      SELECT to_regclass(
        'public.reservation_upgrade_test_markers'
      ) IS NOT NULL AS exists
    `;
    let markerPresent = false;
    if (markerTable.exists) {
      const markerRows = await database<{ marker: string }[]>`
        SELECT marker
        FROM public.reservation_upgrade_test_markers
        WHERE marker = ${upgradeFixtureMarker}
      `;
      markerPresent = markerRows.length === 1;
    }

    const fixtureRows = await database<
      {
        id: string;
        number: number;
        reserved_by_team_id: string | null;
        reserved_at: Date | null;
      }[]
    >`
      SELECT id::text, number, reserved_by_team_id::text, reserved_at
      FROM public.tables
      WHERE id = ANY (
        ${upgradeFixtureTables.map((table) => table.id)}::uuid[]
      )
      ORDER BY id
    `;
    if (markerPresent) {
      expect(
        fixtureRows,
        "marked reservation upgrade fixtures are missing",
      ).toHaveLength(upgradeFixtureTables.length);
    }
    if (fixtureRows.length === 0) {
      return;
    }

    expect(fixtureRows.every((row) => row.number > 0)).toBe(true);
    expect(new Set(fixtureRows.map((row) => row.number)).size).toBe(
      fixtureRows.length,
    );
    expect(
      fixtureRows.map(({ id, reserved_by_team_id }) => ({
        id,
        reservedByTeamId: reserved_by_team_id,
      })),
    ).toEqual(
      upgradeFixtureTables.map((table) => ({
        id: table.id,
        reservedByTeamId: table.teamId,
      })),
    );
    expect(fixtureRows.every((row) => row.reserved_at !== null)).toBe(true);

    const teamRows = await database<{ id: string; name: string }[]>`
      SELECT id::text, name
      FROM public.teams
      WHERE id = ANY (
        ${upgradeFixtureTables.map((table) => table.teamId)}::uuid[]
      )
      ORDER BY id
    `;
    expect(teamRows).toEqual(
      upgradeFixtureTables.map((table) => ({
        id: table.teamId,
        name: `Imported team ${table.teamId}`,
      })),
    );
  });
});
