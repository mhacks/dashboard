import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import postgres from "postgres";
import type { ReservationEventStatus } from "@/lib/reservation/domain";

const { requireOrganizerMock, requireSessionUserMock, revalidatePathMock } =
  vi.hoisted(() => ({
    requireOrganizerMock: vi.fn(),
    requireSessionUserMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock("@/lib/auth/guards", () => ({
  requireOrganizer: requireOrganizerMock,
  requireSessionUser: requireSessionUserMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createReservationTable,
  deleteReservationTable,
  renumberReservationTable,
  setReservationTableCount,
} from "@/lib/actions/admin-reservations.server.actions";
import { reserveTable } from "@/lib/actions/reservation";
import { db } from "@/lib/db";
import { getAdminReservationTables } from "@/lib/queries/admin-reservations";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl
  ? postgres(databaseUrl, { max: 6, prepare: false })
  : null;
const lockDatabase = databaseUrl
  ? postgres(databaseUrl, { max: 1, prepare: false })
  : null;

const organizer = {
  id: "65000000-0000-4000-8000-000000000101",
  email: "reservation-table-organizer@mhacks.test",
  role: "organizer" as const,
  teamId: null,
};
const participantTeamId = "65000000-0000-4000-8000-000000000001";
const participant = {
  id: "65000000-0000-4000-8000-000000000102",
  email: "reservation-table-participant@mhacks.test",
  role: "hacker" as const,
  teamId: participantTeamId,
};
const secondBlockingTeamId = "65000000-0000-4000-8000-000000000002";
const fixtureEventIds = new Set<string>();

function requireDatabase() {
  if (!database) throw new Error("DATABASE_URL is required");
  return database;
}

function requireLockDatabase() {
  if (!lockDatabase) throw new Error("DATABASE_URL is required");
  return lockDatabase;
}

async function createFixtureEvent({
  status = "draft",
}: {
  status?: ReservationEventStatus;
} = {}) {
  const sql = requireDatabase();
  const eventId = randomUUID();
  const eventName = `Table management ${eventId}`;
  fixtureEventIds.add(eventId);
  await sql`
    INSERT INTO public.events (
      id,
      name,
      description,
      location,
      status,
      starts_at
    )
    VALUES (
      ${eventId}::uuid,
      ${eventName},
      'Table management fixture',
      'Duderstadt Center',
      ${status}::public.reservation_event_status,
      '2026-10-04T14:00:00.000Z'
    )
  `;
  return { eventId, eventName };
}

async function addFixtureTable({
  tableId = randomUUID(),
  eventId,
  number,
  teamId = null,
}: {
  tableId?: string;
  eventId: string;
  number: number;
  teamId?: string | null;
}) {
  const sql = requireDatabase();
  await sql`
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
      ${number},
      ${teamId}::uuid,
      ${teamId ? new Date() : null}
    )
  `;
  return tableId;
}

async function loadTopology(eventId: string) {
  const sql = requireDatabase();
  return sql<
    {
      id: string;
      number: number;
      reservedByTeamId: string | null;
    }[]
  >`
    SELECT
      id::text,
      number,
      reserved_by_team_id::text AS "reservedByTeamId"
    FROM public.tables
    WHERE event_id = ${eventId}::uuid
    ORDER BY number, id
  `;
}

async function removeFixtureEvents() {
  const sql = requireDatabase();
  for (const eventId of fixtureEventIds) {
    await sql`DELETE FROM public.events WHERE id = ${eventId}::uuid`;
  }
  fixtureEventIds.clear();
}

async function removeFixturePrincipals() {
  const sql = requireDatabase();
  await sql`
    DELETE FROM public.users
    WHERE id IN (${organizer.id}::uuid, ${participant.id}::uuid)
  `;
  await sql`
    DELETE FROM public.teams
    WHERE id IN (${participantTeamId}::uuid, ${secondBlockingTeamId}::uuid)
  `;
}

async function waitUntilBlockedBy(
  blockingPid: number,
  actionHasSettled: () => boolean,
  timeoutMs = 5_000,
): Promise<boolean> {
  const sql = requireDatabase();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [row] = await sql<{ blocked_waiters: number }[]>`
      SELECT count(*)::integer AS blocked_waiters
      FROM pg_stat_activity AS activity
      WHERE activity.pid <> ${blockingPid}
        AND ${blockingPid} = ANY(pg_blocking_pids(activity.pid))
    `;
    if (row.blocked_waiters > 0) return true;
    if (actionHasSettled()) return false;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

async function waitUntilSettled(
  actionHasSettled: () => boolean,
  timeoutMs = 2_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (actionHasSettled()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

function insertTableInSeparateProcess({
  eventId,
  tableId,
  number,
}: {
  eventId: string;
  tableId: string;
  number: number;
}) {
  const script = `
    import postgres from "postgres";
    const sql = postgres(process.env.DATABASE_URL, { prepare: false });
    try {
      await sql.unsafe(
        \`INSERT INTO public.tables (id, event_id, number)
         VALUES ($1::uuid, $2::uuid, $3::integer)\`,
        [
          process.env.TABLE_ID,
          process.env.EVENT_ID,
          Number(process.env.TABLE_NUMBER),
        ],
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  `;

  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EVENT_ID: eventId,
      TABLE_ID: tableId,
      TABLE_NUMBER: String(number),
    },
    stdio: "pipe",
    timeout: 10_000,
  });
}

const organizerEntryPoints = [
  {
    label: "getAdminReservationTables",
    run: () => getAdminReservationTables("not-a-uuid"),
  },
  {
    label: "createReservationTable",
    run: () => createReservationTable({ eventId: "not-a-uuid", number: 0 }),
  },
  {
    label: "renumberReservationTable",
    run: () =>
      renumberReservationTable({
        eventId: "not-a-uuid",
        tableId: "not-a-uuid",
        number: 0,
      }),
  },
  {
    label: "deleteReservationTable",
    run: () =>
      deleteReservationTable({
        eventId: "not-a-uuid",
        tableId: "not-a-uuid",
      }),
  },
  {
    label: "setReservationTableCount",
    run: () =>
      setReservationTableCount({
        eventId: "not-a-uuid",
        count: -1,
        expectedTables: [],
      }),
  },
] as const;

describe.skipIf(!databaseUrl)("organizer reservation table backends", () => {
  beforeAll(async () => {
    const sql = requireDatabase();
    await removeFixturePrincipals();
    await sql`
      INSERT INTO public.teams (id, name)
      VALUES
        (
          ${participantTeamId}::uuid,
          'Task 5 table participant team'
        ),
        (
          ${secondBlockingTeamId}::uuid,
          'Task 5 second blocking team'
        )
    `;
    await sql`
      INSERT INTO public.users (id, email, role, team_id)
      VALUES
        (
          ${organizer.id}::uuid,
          ${organizer.email},
          ${organizer.role},
          NULL
        ),
        (
          ${participant.id}::uuid,
          ${participant.email},
          ${participant.role},
          ${participant.teamId}::uuid
        )
    `;
    await sql`
      INSERT INTO public.hacker_applicants (
        user_id,
        decision,
        age,
        gender,
        ethnicity,
        university,
        country,
        degree,
        graduation_year,
        previous_hackathons,
        major,
        what_would_you_do,
        why_mhacks,
        hill_to_die_on,
        transportation_type,
        coming_from,
        shirt_size,
        needs_travel_reimbursement
      )
      VALUES (
        ${participant.id}::uuid,
        'regular_accepted',
        21,
        'Prefer not to say',
        'Prefer not to say',
        'University of Michigan',
        'United States',
        'Bachelor''s',
        2027,
        1,
        'Computer Science',
        'Build something useful',
        'Meet other builders',
        'Tests are product features',
        'Local',
        'Ann Arbor, MI',
        'M',
        false
      )
    `;
  });

  beforeEach(() => {
    requireOrganizerMock.mockReset();
    requireOrganizerMock.mockResolvedValue(organizer);
    requireSessionUserMock.mockReset();
    requireSessionUserMock.mockResolvedValue(participant);
    revalidatePathMock.mockReset();
  });

  afterEach(removeFixtureEvents);

  afterAll(async () => {
    if (!database) return;
    await removeFixtureEvents();
    await removeFixturePrincipals();
    await lockDatabase?.end({ timeout: 5 });
    await database.end({ timeout: 5 });
  });

  test.each(organizerEntryPoints)(
    "$label independently authorizes organizer access",
    async ({ run }) => {
      await run();
      expect(requireOrganizerMock).toHaveBeenCalledTimes(1);
    },
  );

  test("returns event detail and tables ordered by number with team names", async () => {
    const { eventId, eventName } = await createFixtureEvent({ status: "open" });
    const tableNineId = await addFixtureTable({ eventId, number: 9 });
    const tableTwoId = await addFixtureTable({
      eventId,
      number: 2,
      teamId: participantTeamId,
    });

    const data = await getAdminReservationTables(eventId);

    expect(data?.event).toMatchObject({
      id: eventId,
      name: eventName,
      status: "open",
      tableCount: 2,
      assignedCount: 1,
    });
    expect(data?.tables).toEqual([
      {
        id: tableTwoId,
        number: 2,
        reservedByTeamId: participantTeamId,
        reservedByTeamName: "Task 5 table participant team",
      },
      {
        id: tableNineId,
        number: 9,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ]);
    await expect(getAdminReservationTables("not-a-uuid")).resolves.toBeNull();
    await expect(getAdminReservationTables(randomUUID())).resolves.toBeNull();
  });

  test("returns table summary and rows from one repeatable-read snapshot", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    const initialTableId = await addFixtureTable({ eventId, number: 1 });
    const concurrentTableId = randomUUID();
    const previousDebug = db.$client.options.debug;
    let concurrentInsertCommitted = false;

    db.$client.options.debug = (_connection, query) => {
      if (
        concurrentInsertCommitted ||
        !query.includes('from "tables"') ||
        !query.includes('left join "teams"') ||
        !query.includes('order by "tables"."number"')
      ) {
        return;
      }
      insertTableInSeparateProcess({
        eventId,
        tableId: concurrentTableId,
        number: 2,
      });
      concurrentInsertCommitted = true;
    };

    let data: Awaited<ReturnType<typeof getAdminReservationTables>>;
    try {
      data = await getAdminReservationTables(eventId);
    } finally {
      db.$client.options.debug = previousDebug;
    }

    expect(concurrentInsertCommitted).toBe(true);
    expect(data?.event.tableCount).toBe(1);
    expect(data?.tables).toEqual([
      {
        id: initialTableId,
        number: 1,
        reservedByTeamId: null,
        reservedByTeamName: null,
      },
    ]);
    expect(data?.event.tableCount).toBe(data?.tables.length);
    const committedTables = await sql<{ id: string }[]>`
      SELECT id::text
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(committedTables.map((table) => table.id)).toEqual([
      initialTableId,
      concurrentTableId,
    ]);
  });

  test.each([0, -1])("rejects invalid table number $number", async (number) => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();

    const result = await createReservationTable({ eventId, number });

    expect(result).toMatchObject({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: {
        number: expect.any(Array),
      },
    });
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    expect(tableCount.count).toBe(0);
  });

  test("rejects table values above product and PostgreSQL limits", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();

    const numberResult = await createReservationTable({
      eventId,
      number: 2_147_483_648,
    });
    const countResult = await setReservationTableCount({
      eventId,
      count: 501,
      expectedTables: [],
    });

    expect(numberResult).toMatchObject({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { number: expect.any(Array) },
    });
    expect(countResult).toMatchObject({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { count: expect.any(Array) },
    });
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    expect(tableCount.count).toBe(0);
  });

  test("rejects a duplicate table number", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    await addFixtureTable({ eventId, number: 4 });

    const result = await createReservationTable({ eventId, number: 4 });

    expect(result).toEqual({
      ok: false,
      error: "That table number is already in use.",
    });
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(tableCount.count).toBe(1);
    expect(auditCount.count).toBe(0);
  });

  test("creates a table and writes table.created atomically", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();

    const result = await createReservationTable({ eventId, number: 6 });

    expect(result).toEqual({ ok: true, message: "Table 6 created." });
    const [table] = await sql<{ id: string; number: number }[]>`
      SELECT id::text, number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    const [audit] = await sql<
      {
        actor_user_id: string;
        action: string;
        entity_type: string;
        entity_id: string;
        details: Record<string, unknown>;
      }[]
    >`
      SELECT
        actor_user_id::text,
        action,
        entity_type,
        entity_id::text,
        details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(audit).toEqual({
      actor_user_id: organizer.id,
      action: "table.created",
      entity_type: "table",
      entity_id: table.id,
      details: {
        tableId: table.id,
        tableNumber: 6,
      },
    });
  });

  test("renumbers an assigned table and writes table.renumbered", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    const tableId = await addFixtureTable({
      eventId,
      number: 3,
      teamId: participantTeamId,
    });

    const result = await renumberReservationTable({
      eventId,
      tableId,
      number: 8,
    });

    expect(result).toEqual({
      ok: true,
      message: "Table 3 renumbered to 8.",
    });
    const [table] = await sql<
      {
        number: number;
        reserved_by_team_id: string;
      }[]
    >`
      SELECT number, reserved_by_team_id::text
      FROM public.tables
      WHERE id = ${tableId}::uuid
    `;
    expect(table).toEqual({
      number: 8,
      reserved_by_team_id: participantTeamId,
    });
    const [audit] = await sql<
      { action: string; entity_id: string; details: Record<string, unknown> }[]
    >`
      SELECT action, entity_id::text, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(audit).toEqual({
      action: "table.renumbered",
      entity_id: tableId,
      details: {
        tableId,
        beforeNumber: 3,
        afterNumber: 8,
      },
    });
  });

  test("rejects renumbering to an occupied number", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    const tableId = await addFixtureTable({ eventId, number: 2 });
    await addFixtureTable({ eventId, number: 5 });

    const result = await renumberReservationTable({
      eventId,
      tableId,
      number: 5,
    });

    expect(result).toEqual({
      ok: false,
      error: "That table number is already in use.",
    });
    const [table] = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE id = ${tableId}::uuid
    `;
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(table.number).toBe(2);
    expect(auditCount.count).toBe(0);
  });

  test("serializes concurrent inverse renumbers without deadlocking", async () => {
    const sql = requireDatabase();
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent();
    const firstTableId = await addFixtureTable({
      tableId: "65000000-0000-4000-8000-000000001001",
      eventId,
      number: 1,
    });
    const secondTableId = await addFixtureTable({
      tableId: "65000000-0000-4000-8000-000000001002",
      eventId,
      number: 2,
    });
    let firstAction!: ReturnType<typeof renumberReservationTable>;
    let secondAction!: ReturnType<typeof renumberReservationTable>;
    let settledCount = 0;
    let lockReadsDispatched = 0;
    let topologyWasSerialized = false;

    await lockSql.begin(async (transaction) => {
      await transaction`
        SELECT id
        FROM public.tables
        WHERE id IN (${firstTableId}::uuid, ${secondTableId}::uuid)
        ORDER BY id
        FOR UPDATE
      `;
      const previousDebug = db.$client.options.debug;
      db.$client.options.debug = (_connection, query) => {
        if (query.includes('from "tables"') && query.includes("for update")) {
          lockReadsDispatched += 1;
        }
      };

      try {
        firstAction = renumberReservationTable({
          eventId,
          tableId: firstTableId,
          number: 2,
        });
        secondAction = renumberReservationTable({
          eventId,
          tableId: secondTableId,
          number: 1,
        });
        void firstAction.finally(() => {
          settledCount += 1;
        });
        void secondAction.finally(() => {
          settledCount += 1;
        });

        const deadline = Date.now() + 2_000;
        while (Date.now() < deadline) {
          if (lockReadsDispatched >= 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            topologyWasSerialized =
              lockReadsDispatched === 1 && settledCount === 0;
            break;
          }
          if (settledCount > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } finally {
        db.$client.options.debug = previousDebug;
      }
    });

    const results = await Promise.all([firstAction, secondAction]);

    expect(topologyWasSerialized).toBe(true);
    expect(results).toEqual([
      {
        ok: false,
        error: "That table number is already in use.",
      },
      {
        ok: false,
        error: "That table number is already in use.",
      },
    ]);
    const rows = await sql<{ id: string; number: number }[]>`
      SELECT id::text, number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(rows).toEqual([
      { id: firstTableId, number: 1 },
      { id: secondTableId, number: 2 },
    ]);
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(auditCount.count).toBe(0);
  });

  test("rejects deleting an assigned table", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    const tableId = await addFixtureTable({
      eventId,
      number: 11,
      teamId: participantTeamId,
    });

    const result = await deleteReservationTable({ eventId, tableId });

    expect(result).toEqual({
      ok: false,
      error: "Table 11 is assigned. Unassign the team first.",
    });
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE id = ${tableId}::uuid
    `;
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(tableCount.count).toBe(1);
    expect(auditCount.count).toBe(0);
  });

  test("deletes an unassigned table and writes table.deleted", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    const tableId = await addFixtureTable({ eventId, number: 12 });

    const result = await deleteReservationTable({ eventId, tableId });

    expect(result).toEqual({ ok: true, message: "Table 12 deleted." });
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE id = ${tableId}::uuid
    `;
    const [audit] = await sql<
      { action: string; entity_id: string; details: Record<string, unknown> }[]
    >`
      SELECT action, entity_id::text, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(tableCount.count).toBe(0);
    expect(audit).toEqual({
      action: "table.deleted",
      entity_id: tableId,
      details: {
        tableId,
        tableNumber: 12,
      },
    });
  });

  test("count growth appends sequentially above the highest number", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    await addFixtureTable({ eventId, number: 2 });
    await addFixtureTable({ eventId, number: 7 });

    const result = await setReservationTableCount({
      eventId,
      count: 5,
      expectedTables: await loadTopology(eventId),
    });

    expect(result).toEqual({ ok: true, message: "Table count set to 5." });
    const rows = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(rows.map((row) => row.number)).toEqual([2, 7, 8, 9, 10]);
    const [audit] = await sql<
      { action: string; details: Record<string, unknown> }[]
    >`
      SELECT action, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(audit).toMatchObject({
      action: "table.count_changed",
      details: {
        beforeCount: 2,
        afterCount: 5,
        addedNumbers: [8, 9, 10],
        removedNumbers: [],
      },
    });
  });

  test("rejects count growth when the next table number would overflow", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    await addFixtureTable({
      eventId,
      number: 2_147_483_647,
    });

    const result = await setReservationTableCount({
      eventId,
      count: 2,
      expectedTables: await loadTopology(eventId),
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Cannot add tables because table numbers would exceed 2,147,483,647.",
    });
    const rows = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    expect(rows).toEqual([{ number: 2_147_483_647 }]);
  });

  test("serializes mixed-case create before count and rejects the stale reviewed topology", async () => {
    const sql = requireDatabase();
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent();
    const upperEventId = eventId.toUpperCase();
    await addFixtureTable({ eventId, number: 1 });
    const reviewedTables = await loadTopology(eventId);
    let createPromise!: ReturnType<typeof createReservationTable>;
    let countPromise!: ReturnType<typeof setReservationTableCount>;
    let createSettled = false;
    let countSettled = false;
    let createWasBlocked = false;
    let countSettledBeforeRelease = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended((${eventId}::uuid)::text, 0)
        )
      `;

      createPromise = createReservationTable({
        eventId: upperEventId,
        number: 2,
      });
      void createPromise.finally(() => {
        createSettled = true;
      });
      createWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => createSettled,
      );

      countPromise = setReservationTableCount({
        eventId,
        count: 3,
        expectedTables: reviewedTables,
      });
      void countPromise.finally(() => {
        countSettled = true;
      });
      countSettledBeforeRelease = await waitUntilSettled(() => countSettled);
    });

    const [createResult, countResult] = await Promise.all([
      createPromise,
      countPromise,
    ]);
    expect(createWasBlocked).toBe(true);
    expect(countSettledBeforeRelease).toBe(false);
    expect(createResult).toEqual({ ok: true, message: "Table 2 created." });
    expect(countResult).toEqual({
      ok: false,
      error:
        "Table layout changed since this count was reviewed. Refresh and try again.",
    });
    const rows = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(rows.map((row) => row.number)).toEqual([1, 2]);
    const audits = await sql<{ action: string }[]>`
      SELECT action
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
      ORDER BY created_at, id
    `;
    expect(audits.map((audit) => audit.action)).toEqual(["table.created"]);
  });

  test("serializes mixed-case renumber before reduction and preserves the reviewed rows", async () => {
    const sql = requireDatabase();
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent();
    const upperEventId = eventId.toUpperCase();
    await addFixtureTable({ eventId, number: 1 });
    await addFixtureTable({ eventId, number: 2 });
    const renumberedTableId = await addFixtureTable({ eventId, number: 3 });
    const reviewedTables = await loadTopology(eventId);
    let renumberPromise!: ReturnType<typeof renumberReservationTable>;
    let countPromise!: ReturnType<typeof setReservationTableCount>;
    let renumberSettled = false;
    let countSettled = false;
    let renumberWasBlocked = false;
    let countSettledBeforeRelease = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended((${eventId}::uuid)::text, 0)
        )
      `;

      renumberPromise = renumberReservationTable({
        eventId: upperEventId,
        tableId: renumberedTableId,
        number: 4,
      });
      void renumberPromise.finally(() => {
        renumberSettled = true;
      });
      renumberWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => renumberSettled,
      );

      countPromise = setReservationTableCount({
        eventId,
        count: 2,
        expectedTables: reviewedTables,
      });
      void countPromise.finally(() => {
        countSettled = true;
      });
      countSettledBeforeRelease = await waitUntilSettled(() => countSettled);
    });

    const [renumberResult, countResult] = await Promise.all([
      renumberPromise,
      countPromise,
    ]);
    expect(renumberWasBlocked).toBe(true);
    expect(countSettledBeforeRelease).toBe(false);
    expect(renumberResult).toEqual({
      ok: true,
      message: "Table 3 renumbered to 4.",
    });
    expect(countResult).toEqual({
      ok: false,
      error:
        "Table layout changed since this count was reviewed. Refresh and try again.",
    });
    const rows = await sql<{ id: string; number: number }[]>`
      SELECT id::text, number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(rows.map((row) => row.number)).toEqual([1, 2, 4]);
    expect(rows.find((row) => row.number === 4)?.id).toBe(renumberedTableId);
  });

  test("records count audit afterCount across mixed-case serialized topology calls", async () => {
    const sql = requireDatabase();
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent();
    const upperEventId = eventId.toUpperCase();
    await addFixtureTable({ eventId, number: 1 });
    const reviewedTables = await loadTopology(eventId);
    let countPromise!: ReturnType<typeof setReservationTableCount>;
    let createPromise!: ReturnType<typeof createReservationTable>;
    let countSettled = false;
    let countWasBlocked = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended((${eventId}::uuid)::text, 0)
        )
      `;

      countPromise = setReservationTableCount({
        eventId: upperEventId,
        count: 3,
        expectedTables: reviewedTables,
      });
      void countPromise.finally(() => {
        countSettled = true;
      });
      countWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => countSettled,
      );
      createPromise = createReservationTable({ eventId, number: 10 });
    });

    const [countResult, createResult] = await Promise.all([
      countPromise,
      createPromise,
    ]);
    expect(countWasBlocked).toBe(true);
    expect(countResult).toEqual({
      ok: true,
      message: "Table count set to 3.",
    });
    expect(createResult).toEqual({ ok: true, message: "Table 10 created." });
    const [countAudit] = await sql<{ details: Record<string, unknown> }[]>`
      SELECT details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
        AND action = 'table.count_changed'
    `;
    expect(countAudit.details).toMatchObject({
      beforeCount: 1,
      afterCount: 3,
      addedNumbers: [2, 3],
    });
    const [finalCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    expect(finalCount.count).toBe(4);
  });

  test("count reduction removes the highest-numbered tables in one transaction", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    await addFixtureTable({ eventId, number: 1 });
    await addFixtureTable({ eventId, number: 4 });
    const tableNineId = await addFixtureTable({ eventId, number: 9 });
    const tableTwelveId = await addFixtureTable({ eventId, number: 12 });

    const result = await setReservationTableCount({
      eventId,
      count: 2,
      expectedTables: await loadTopology(eventId),
    });

    expect(result).toEqual({ ok: true, message: "Table count set to 2." });
    const rows = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(rows.map((row) => row.number)).toEqual([1, 4]);
    const [audit] = await sql<
      { action: string; details: Record<string, unknown> }[]
    >`
      SELECT action, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(audit).toMatchObject({
      action: "table.count_changed",
      details: {
        beforeCount: 4,
        afterCount: 2,
        addedNumbers: [],
        removedTableIds: expect.arrayContaining([tableNineId, tableTwelveId]),
        removedNumbers: [9, 12],
      },
    });
  });

  test("blocked count reduction reports every occupied target and deletes nothing", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    await addFixtureTable({ eventId, number: 1 });
    await addFixtureTable({
      eventId,
      number: 7,
      teamId: participantTeamId,
    });
    await addFixtureTable({ eventId, number: 8 });
    await addFixtureTable({
      eventId,
      number: 9,
      teamId: secondBlockingTeamId,
    });

    const result = await setReservationTableCount({
      eventId,
      count: 1,
      expectedTables: await loadTopology(eventId),
    });

    expect(result).toEqual({
      ok: false,
      error: "Cannot remove assigned tables: 7, 9. Unassign them first.",
    });
    const rows = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
      ORDER BY number
    `;
    expect(rows.map((row) => row.number)).toEqual([1, 7, 8, 9]);
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(auditCount.count).toBe(0);
  });

  test.each([
    {
      label: "create",
      run: ({ eventId }: { eventId: string; tableId: string }) =>
        createReservationTable({ eventId, number: 2 }),
    },
    {
      label: "renumber",
      run: ({ eventId, tableId }: { eventId: string; tableId: string }) =>
        renumberReservationTable({ eventId, tableId, number: 2 }),
    },
    {
      label: "delete",
      run: ({ eventId, tableId }: { eventId: string; tableId: string }) =>
        deleteReservationTable({ eventId, tableId }),
    },
    {
      label: "count",
      run: ({ eventId, tableId }: { eventId: string; tableId: string }) =>
        setReservationTableCount({
          eventId,
          count: 0,
          expectedTables: [{ id: tableId, number: 1, reservedByTeamId: null }],
        }),
    },
  ])("rejects $label mutations for archived events", async ({ run }) => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent({ status: "archived" });
    const tableId = await addFixtureTable({ eventId, number: 1 });

    const result = await run({ eventId, tableId });

    expect(result).toEqual({
      ok: false,
      error: "Archived events are read-only. Restore the event before editing.",
    });
    const rows = await sql<{ number: number }[]>`
      SELECT number
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    expect(rows).toEqual([{ number: 1 }]);
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(auditCount.count).toBe(0);
  });

  test("rolls back table creation when the real audit insert fails", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    requireOrganizerMock.mockResolvedValue({
      ...organizer,
      id: randomUUID(),
    });

    const result = await createReservationTable({ eventId, number: 1 });

    expect(result).toEqual({
      ok: false,
      error: "A related record no longer exists. Refresh and try again.",
    });
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(tableCount.count).toBe(0);
    expect(auditCount.count).toBe(0);
  });

  test("waits for a lifecycle archive and then rejects the table mutation", async () => {
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent({ status: "open" });
    let actionPromise!: ReturnType<typeof createReservationTable>;
    let actionSettled = false;
    let actionWasBlocked = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        UPDATE public.events
        SET status = 'archived', updated_at = now()
        WHERE id = ${eventId}::uuid
      `;
      actionPromise = createReservationTable({ eventId, number: 1 });
      void actionPromise.then(
        () => {
          actionSettled = true;
        },
        () => {
          actionSettled = true;
        },
      );
      actionWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => actionSettled,
      );
    });

    const result = await actionPromise;
    expect(actionWasBlocked).toBe(true);
    expect(result).toEqual({
      ok: false,
      error: "Archived events are read-only. Restore the event before editing.",
    });
  });

  test("deletion observes an assignment that commits while locking the table", async () => {
    const sql = requireDatabase();
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent();
    const tableId = await addFixtureTable({ eventId, number: 1 });
    let actionPromise!: ReturnType<typeof deleteReservationTable>;
    let actionSettled = false;
    let actionWasBlocked = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        UPDATE public.tables
        SET
          reserved_by_team_id = ${participantTeamId}::uuid,
          reserved_at = now()
        WHERE id = ${tableId}::uuid
      `;
      actionPromise = deleteReservationTable({ eventId, tableId });
      void actionPromise.then(
        () => {
          actionSettled = true;
        },
        () => {
          actionSettled = true;
        },
      );
      actionWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => actionSettled,
      );
    });

    const result = await actionPromise;
    expect(actionWasBlocked).toBe(true);
    expect(result).toEqual({
      ok: false,
      error: "Table 1 is assigned. Unassign the team first.",
    });
    const [table] = await sql<{ reserved_by_team_id: string }[]>`
      SELECT reserved_by_team_id::text
      FROM public.tables
      WHERE id = ${tableId}::uuid
    `;
    expect(table.reserved_by_team_id).toBe(participantTeamId);
  });

  test("a blocked table writer does not serialize a participant on another table", async () => {
    const lockSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent({ status: "open" });
    const blockedTableId = await addFixtureTable({ eventId, number: 1 });
    const participantTableId = await addFixtureTable({ eventId, number: 2 });
    let tableAction!: ReturnType<typeof deleteReservationTable>;
    let participantAction!: ReturnType<typeof reserveTable>;
    let tableActionSettled = false;
    let participantActionSettled = false;
    let tableActionWasBlocked = false;
    let participantSettledBeforeRelease = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT id
        FROM public.tables
        WHERE id = ${blockedTableId}::uuid
        FOR UPDATE
      `;

      tableAction = deleteReservationTable({
        eventId,
        tableId: blockedTableId,
      });
      void tableAction.then(
        () => {
          tableActionSettled = true;
        },
        () => {
          tableActionSettled = true;
        },
      );
      tableActionWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => tableActionSettled,
      );

      participantAction = reserveTable({ tableId: participantTableId });
      void participantAction.then(
        () => {
          participantActionSettled = true;
        },
        () => {
          participantActionSettled = true;
        },
      );
      participantSettledBeforeRelease = await waitUntilSettled(
        () => participantActionSettled,
      );
    });

    const [tableResult, participantResult] = await Promise.all([
      tableAction,
      participantAction,
    ]);
    expect(tableActionWasBlocked).toBe(true);
    expect(participantSettledBeforeRelease).toBe(true);
    expect(tableResult).toEqual({ ok: true, message: "Table 1 deleted." });
    expect(participantResult).toEqual({
      ok: true,
      message: "Reserved table 2.",
    });
  });
});
