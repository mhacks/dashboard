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
  moveReservationTeam,
  renumberReservationTable,
  unassignReservationTeam,
} from "@/lib/actions/admin-reservations.server.actions";
import { reserveTable } from "@/lib/actions/reservation";
import { db } from "@/lib/db";
import { getAdminReservationAssignments } from "@/lib/queries/admin-reservations";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl
  ? postgres(databaseUrl, { max: 8, prepare: false })
  : null;
const lockDatabase = databaseUrl
  ? postgres(databaseUrl, { max: 1, prepare: false })
  : null;

const teamAId = "66000000-0000-4000-8000-000000000001";
const teamBId = "66000000-0000-4000-8000-000000000002";
const teamCId = "66000000-0000-4000-8000-000000000003";
const organizer = {
  id: "66000000-0000-4000-8000-000000000101",
  email: "reservation-assignment-organizer@mhacks.test",
  role: "organizer" as const,
  teamId: null,
};
const participantB = {
  id: "66000000-0000-4000-8000-000000000102",
  email: "reservation-assignment-participant@mhacks.test",
  role: "hacker" as const,
  teamId: teamBId,
};
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
  const eventName = `Assignment management ${eventId}`;
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
      'Assignment management fixture',
      'Michigan Union',
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
      ${teamId ? new Date("2026-08-25T12:00:00.000Z") : null}
    )
  `;
  return tableId;
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
    WHERE id IN (${organizer.id}::uuid, ${participantB.id}::uuid)
  `;
  await sql`
    DELETE FROM public.teams
    WHERE id IN (${teamAId}::uuid, ${teamBId}::uuid, ${teamCId}::uuid)
  `;
}

async function waitUntilBlockedBy(
  blockingPid: number,
  actionHasSettled: () => boolean,
  timeoutMs = 5_000,
): Promise<boolean> {
  return waitUntilBlockedWaiterCount(
    blockingPid,
    1,
    actionHasSettled,
    timeoutMs,
  );
}

async function waitUntilBlockedWaiterCount(
  blockingPid: number,
  minimumWaiters: number,
  actionsHaveSettled: () => boolean,
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
    if (row.blocked_waiters >= minimumWaiters) return true;
    if (actionsHaveSettled()) return false;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

async function waitForBlockedPid(
  blockingPid: number,
  actionHasSettled: () => boolean,
  timeoutMs = 5_000,
): Promise<number | null> {
  const sql = requireDatabase();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [row] = await sql<{ pid: number }[]>`
      SELECT activity.pid
      FROM pg_stat_activity AS activity
      WHERE activity.pid <> ${blockingPid}
        AND ${blockingPid} = ANY(pg_blocking_pids(activity.pid))
      ORDER BY activity.pid
      LIMIT 1
    `;
    if (row) return row.pid;
    if (actionHasSettled()) return null;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
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

async function loadAssignments(eventId: string) {
  const sql = requireDatabase();
  return sql<
    {
      id: string;
      number: number;
      reserved_by_team_id: string | null;
      reserved_at: Date | null;
    }[]
  >`
    SELECT
      id::text,
      number,
      reserved_by_team_id::text,
      reserved_at
    FROM public.tables
    WHERE event_id = ${eventId}::uuid
    ORDER BY number
  `;
}

async function loadAudit(eventId: string) {
  const sql = requireDatabase();
  return sql<
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
    ORDER BY created_at, id
  `;
}

function reassignTableInSeparateProcess({
  tableId,
  teamId,
}: {
  tableId: string;
  teamId: string;
}) {
  const script = `
    import postgres from "postgres";
    const sql = postgres(process.env.DATABASE_URL, { prepare: false });
    try {
      await sql.unsafe(
        \`UPDATE public.tables
         SET reserved_by_team_id = $2::uuid, reserved_at = now()
         WHERE id = $1::uuid\`,
        [process.env.TABLE_ID, process.env.TEAM_ID],
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  `;

  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TABLE_ID: tableId,
      TEAM_ID: teamId,
    },
    stdio: "pipe",
    timeout: 10_000,
  });
}

const organizerEntryPoints = [
  {
    label: "getAdminReservationAssignments",
    run: () => getAdminReservationAssignments("not-a-uuid"),
  },
  {
    label: "moveReservationTeam",
    run: () =>
      moveReservationTeam({
        eventId: "not-a-uuid",
        teamId: "not-a-uuid",
        tableId: "not-a-uuid",
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 1,
        expectedDestinationTeamId: null,
      }),
  },
  {
    label: "unassignReservationTeam",
    run: () =>
      unassignReservationTeam({
        eventId: "not-a-uuid",
        teamId: "not-a-uuid",
        expectedSourceTableId: "11111111-1111-4111-8111-111111111111",
        expectedSourceTableNumber: 1,
      }),
  },
] as const;

describe.skipIf(!databaseUrl)(
  "organizer reservation assignment backends",
  () => {
    beforeAll(async () => {
      const sql = requireDatabase();
      await removeFixturePrincipals();
      await sql`
        INSERT INTO public.teams (id, name)
        VALUES
          (${teamAId}::uuid, 'Task 5 assignment Alpha'),
          (${teamBId}::uuid, 'Task 5 assignment Bravo'),
          (${teamCId}::uuid, 'Task 5 assignment Charlie')
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
            ${participantB.id}::uuid,
            ${participantB.email},
            ${participantB.role},
            ${participantB.teamId}::uuid
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
          ${participantB.id}::uuid,
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
      requireSessionUserMock.mockResolvedValue(participantB);
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

    test("returns sorted teams, ordered tables, and each current table", async () => {
      const { eventId, eventName } = await createFixtureEvent({
        status: "closed",
      });
      const tableEightId = await addFixtureTable({ eventId, number: 8 });
      const tableTwoId = await addFixtureTable({
        eventId,
        number: 2,
        teamId: teamBId,
      });

      const data = await getAdminReservationAssignments(eventId);

      expect(data?.event).toMatchObject({
        id: eventId,
        name: eventName,
        status: "closed",
        tableCount: 2,
        assignedCount: 1,
      });
      expect(
        data?.teams
          .filter((team) => [teamAId, teamBId, teamCId].includes(team.id))
          .map(({ id, name, tableId, tableNumber }) => ({
            id,
            name,
            tableId,
            tableNumber,
          })),
      ).toEqual([
        {
          id: teamAId,
          name: "Task 5 assignment Alpha",
          tableId: null,
          tableNumber: null,
        },
        {
          id: teamBId,
          name: "Task 5 assignment Bravo",
          tableId: tableTwoId,
          tableNumber: 2,
        },
        {
          id: teamCId,
          name: "Task 5 assignment Charlie",
          tableId: null,
          tableNumber: null,
        },
      ]);
      expect(
        data?.teams.find((team) => team.id === teamAId)?.createdAt,
      ).toBeInstanceOf(Date);
      expect(data?.tables).toEqual([
        {
          id: tableTwoId,
          number: 2,
          reservedByTeamId: teamBId,
          reservedByTeamName: "Task 5 assignment Bravo",
        },
        {
          id: tableEightId,
          number: 8,
          reservedByTeamId: null,
          reservedByTeamName: null,
        },
      ]);
      await expect(
        getAdminReservationAssignments("not-a-uuid"),
      ).resolves.toBeNull();
      await expect(
        getAdminReservationAssignments(randomUUID()),
      ).resolves.toBeNull();
    });

    test("returns team assignments and table rows from one repeatable-read snapshot", async () => {
      const sql = requireDatabase();
      const { eventId } = await createFixtureEvent();
      const tableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const previousDebug = db.$client.options.debug;
      let concurrentReassignmentCommitted = false;

      db.$client.options.debug = (_connection, query) => {
        if (
          concurrentReassignmentCommitted ||
          !query.includes('from "tables"') ||
          !query.includes('left join "teams"') ||
          !query.includes('order by "tables"."number"')
        ) {
          return;
        }
        reassignTableInSeparateProcess({ tableId, teamId: teamBId });
        concurrentReassignmentCommitted = true;
      };

      let data: Awaited<ReturnType<typeof getAdminReservationAssignments>>;
      try {
        data = await getAdminReservationAssignments(eventId);
      } finally {
        db.$client.options.debug = previousDebug;
      }

      expect(concurrentReassignmentCommitted).toBe(true);
      expect(data?.teams.find((team) => team.id === teamAId)).toMatchObject({
        tableId,
        tableNumber: 1,
      });
      expect(data?.teams.find((team) => team.id === teamBId)).toMatchObject({
        tableId: null,
        tableNumber: null,
      });
      expect(data?.tables).toEqual([
        {
          id: tableId,
          number: 1,
          reservedByTeamId: teamAId,
          reservedByTeamName: "Task 5 assignment Alpha",
        },
      ]);
      const [committedTable] = await sql<{ reserved_by_team_id: string }[]>`
        SELECT reserved_by_team_id::text
        FROM public.tables
        WHERE id = ${tableId}::uuid
      `;
      expect(committedTable.reserved_by_team_id).toBe(teamBId);
    });

    test("rejects malformed assignment identifiers before database writes", async () => {
      const result = await moveReservationTeam({
        eventId: "not-a-uuid",
        teamId: "not-a-uuid",
        tableId: "not-a-uuid",
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 1,
        expectedDestinationTeamId: null,
      });

      expect(result).toMatchObject({
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: {
          eventId: expect.any(Array),
          teamId: expect.any(Array),
          tableId: expect.any(Array),
        },
      });
    });

    test("rejects a team that does not exist", async () => {
      const sql = requireDatabase();
      const { eventId } = await createFixtureEvent();
      const tableId = await addFixtureTable({ eventId, number: 1 });

      const result = await moveReservationTeam({
        eventId,
        teamId: randomUUID(),
        tableId,
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 1,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "That team no longer exists.",
      });
      const [auditCount] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM public.reservation_audit_log
        WHERE event_id = ${eventId}::uuid
      `;
      expect(auditCount.count).toBe(0);
    });

    test("rejects a destination table from another event", async () => {
      const { eventId } = await createFixtureEvent();
      const otherEvent = await createFixtureEvent();
      const otherTableId = await addFixtureTable({
        eventId: otherEvent.eventId,
        number: 1,
      });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId: otherTableId,
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 1,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "That table no longer exists for this event.",
      });
      expect(await loadAssignments(otherEvent.eventId)).toEqual([
        {
          id: otherTableId,
          number: 1,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
    });

    test("assigns an unassigned team to an empty table", async () => {
      const { eventId } = await createFixtureEvent();
      const tableId = await addFixtureTable({ eventId, number: 1 });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId,
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 1,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: true,
        message: "Assigned team to table 1.",
      });
      const assignments = await loadAssignments(eventId);
      expect(assignments[0]).toMatchObject({
        id: tableId,
        reserved_by_team_id: teamAId,
        reserved_at: expect.any(Date),
      });
      expect(await loadAudit(eventId)).toEqual([
        {
          actor_user_id: organizer.id,
          action: "assignment.assigned",
          entity_type: "assignment",
          entity_id: teamAId,
          details: {
            teamId: teamAId,
            tableId,
            fromTableId: null,
            toTableId: tableId,
            teamIds: [teamAId],
            tableIds: [tableId],
          },
        },
      ]);
    });

    test("moves an assigned team to an empty table", async () => {
      const { eventId } = await createFixtureEvent();
      const fromTableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const toTableId = await addFixtureTable({ eventId, number: 2 });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId: toTableId,
        expectedSourceTableId: fromTableId,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 2,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: true,
        message: "Moved team from table 1 to table 2.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: fromTableId,
          number: 1,
          reserved_by_team_id: null,
          reserved_at: null,
        },
        {
          id: toTableId,
          number: 2,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      expect(await loadAudit(eventId)).toEqual([
        {
          actor_user_id: organizer.id,
          action: "assignment.moved",
          entity_type: "assignment",
          entity_id: teamAId,
          details: {
            teamId: teamAId,
            fromTableId,
            toTableId,
            teamIds: [teamAId],
            tableIds: [fromTableId, toTableId],
          },
        },
      ]);
    });

    test("rejects a move when the confirmed source table was renumbered", async () => {
      const { eventId } = await createFixtureEvent();
      const sourceTableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const destinationTableId = await addFixtureTable({
        eventId,
        number: 2,
      });
      await expect(
        renumberReservationTable({
          eventId,
          tableId: sourceTableId,
          number: 9,
        }),
      ).resolves.toEqual({
        ok: true,
        message: "Table 1 renumbered to 9.",
      });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId: destinationTableId,
        expectedSourceTableId: sourceTableId,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 2,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: destinationTableId,
          number: 2,
          reserved_by_team_id: null,
          reserved_at: null,
        },
        {
          id: sourceTableId,
          number: 9,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits.map((audit) => audit.action)).toEqual(["table.renumbered"]);
    });

    test("rejects a move when the confirmed destination was renumbered", async () => {
      const { eventId } = await createFixtureEvent();
      const sourceTableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const destinationTableId = await addFixtureTable({
        eventId,
        number: 2,
      });
      await expect(
        renumberReservationTable({
          eventId,
          tableId: destinationTableId,
          number: 8,
        }),
      ).resolves.toEqual({
        ok: true,
        message: "Table 2 renumbered to 8.",
      });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId: destinationTableId,
        expectedSourceTableId: sourceTableId,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 2,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: sourceTableId,
          number: 1,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
        {
          id: destinationTableId,
          number: 8,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits.map((audit) => audit.action)).toEqual(["table.renumbered"]);
    });

    test("rejects a move when a participant occupies the confirmed destination", async () => {
      const { eventId } = await createFixtureEvent({ status: "open" });
      const sourceTableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const destinationTableId = await addFixtureTable({
        eventId,
        number: 2,
      });

      await expect(
        reserveTable({ tableId: destinationTableId }),
      ).resolves.toEqual({
        ok: true,
        message: "Reserved table 2.",
      });
      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId: destinationTableId,
        expectedSourceTableId: sourceTableId,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 2,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: sourceTableId,
          number: 1,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
        {
          id: destinationTableId,
          number: 2,
          reserved_by_team_id: teamBId,
          reserved_at: expect.any(Date),
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe("assignment.reserved");
    });

    test("swaps teams when the selected team and destination are assigned", async () => {
      const { eventId } = await createFixtureEvent();
      const fromTableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const toTableId = await addFixtureTable({
        eventId,
        number: 2,
        teamId: teamBId,
      });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId: toTableId,
        expectedSourceTableId: fromTableId,
        expectedSourceTableNumber: 1,
        expectedDestinationTableNumber: 2,
        expectedDestinationTeamId: teamBId,
      });

      expect(result).toEqual({
        ok: true,
        message: "Swapped teams between tables 1 and 2.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: fromTableId,
          number: 1,
          reserved_by_team_id: teamBId,
          reserved_at: expect.any(Date),
        },
        {
          id: toTableId,
          number: 2,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      expect(await loadAudit(eventId)).toEqual([
        {
          actor_user_id: organizer.id,
          action: "assignment.swapped",
          entity_type: "assignment",
          entity_id: teamAId,
          details: {
            teamId: teamAId,
            swappedTeamId: teamBId,
            fromTableId,
            toTableId,
            teamIds: [teamAId, teamBId],
            tableIds: [fromTableId, toTableId],
          },
        },
      ]);
    });

    test("rejects unassign when the confirmed source table was renumbered", async () => {
      const { eventId } = await createFixtureEvent();
      const sourceTableId = await addFixtureTable({
        eventId,
        number: 5,
        teamId: teamAId,
      });
      await expect(
        renumberReservationTable({
          eventId,
          tableId: sourceTableId,
          number: 12,
        }),
      ).resolves.toEqual({
        ok: true,
        message: "Table 5 renumbered to 12.",
      });

      const result = await unassignReservationTeam({
        eventId,
        teamId: teamAId,
        expectedSourceTableId: sourceTableId,
        expectedSourceTableNumber: 5,
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: sourceTableId,
          number: 12,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits.map((audit) => audit.action)).toEqual(["table.renumbered"]);
    });

    test("displaces an occupied table when the selected team is unassigned", async () => {
      const { eventId } = await createFixtureEvent();
      const tableId = await addFixtureTable({
        eventId,
        number: 4,
        teamId: teamBId,
      });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId,
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 4,
        expectedDestinationTeamId: teamBId,
      });

      expect(result).toEqual({
        ok: true,
        message: "Moved team to table 4. Previous occupant was unassigned.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: tableId,
          number: 4,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      expect(await loadAudit(eventId)).toEqual([
        {
          actor_user_id: organizer.id,
          action: "assignment.displaced",
          entity_type: "assignment",
          entity_id: teamAId,
          details: {
            teamId: teamAId,
            displacedTeamId: teamBId,
            tableId,
            fromTableId: null,
            toTableId: tableId,
            teamIds: [teamAId, teamBId],
            tableIds: [tableId],
          },
        },
      ]);
    });

    test("unassigns a team and clears both assignment fields", async () => {
      const { eventId } = await createFixtureEvent();
      const tableId = await addFixtureTable({
        eventId,
        number: 5,
        teamId: teamAId,
      });

      const result = await unassignReservationTeam({
        eventId,
        teamId: teamAId,
        expectedSourceTableId: tableId,
        expectedSourceTableNumber: 5,
      });

      expect(result).toEqual({
        ok: true,
        message: "Unassigned team from table 5.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: tableId,
          number: 5,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
      expect(await loadAudit(eventId)).toEqual([
        {
          actor_user_id: organizer.id,
          action: "assignment.unassigned",
          entity_type: "assignment",
          entity_id: teamAId,
          details: {
            teamId: teamAId,
            tableId,
            fromTableId: tableId,
            toTableId: null,
            teamIds: [teamAId],
            tableIds: [tableId],
          },
        },
      ]);
    });

    test.each([
      {
        label: "move",
        run: ({
          eventId,
          fromTableId,
          toTableId,
        }: {
          eventId: string;
          fromTableId: string;
          toTableId: string;
        }) =>
          moveReservationTeam({
            eventId,
            teamId: teamAId,
            tableId: toTableId,
            expectedSourceTableId: fromTableId,
            expectedSourceTableNumber: 1,
            expectedDestinationTableNumber: 2,
            expectedDestinationTeamId: null,
          }),
      },
      {
        label: "unassign",
        run: ({
          eventId,
          fromTableId,
        }: {
          eventId: string;
          fromTableId: string;
          toTableId: string;
        }) =>
          unassignReservationTeam({
            eventId,
            teamId: teamAId,
            expectedSourceTableId: fromTableId,
            expectedSourceTableNumber: 1,
          }),
      },
    ])("rejects $label for archived events", async ({ run }) => {
      const { eventId } = await createFixtureEvent({ status: "archived" });
      const fromTableId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const toTableId = await addFixtureTable({ eventId, number: 2 });

      const result = await run({ eventId, fromTableId, toTableId });

      expect(result).toEqual({
        ok: false,
        error:
          "Archived events are read-only. Restore the event before editing.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: fromTableId,
          number: 1,
          reserved_by_team_id: teamAId,
          reserved_at: new Date("2026-08-25T12:00:00.000Z"),
        },
        {
          id: toTableId,
          number: 2,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
      expect(await loadAudit(eventId)).toEqual([]);
    });

    test("rejects an organizer move whose confirmed source changed", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent();
      const sourceTableId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000001001",
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const firstTargetId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000001002",
        eventId,
        number: 2,
      });
      const secondTargetId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000001003",
        eventId,
        number: 3,
      });
      let relocation!: ReturnType<typeof moveReservationTeam>;
      let competingMove!: ReturnType<typeof moveReservationTeam>;
      let relocationSettled = false;
      let competingMoveSettled = false;
      let relocationPid: number | null = null;
      let competingMoveWasBlocked = false;

      await lockSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          SELECT id
          FROM public.tables
          WHERE id = ${firstTargetId}::uuid
          FOR UPDATE
        `;

        relocation = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId: firstTargetId,
          expectedSourceTableId: sourceTableId,
          expectedSourceTableNumber: 1,
          expectedDestinationTableNumber: 2,
          expectedDestinationTeamId: null,
        });
        void relocation.finally(() => {
          relocationSettled = true;
        });
        relocationPid = await waitForBlockedPid(
          holder.pid,
          () => relocationSettled,
        );

        competingMove = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId: secondTargetId,
          expectedSourceTableId: sourceTableId,
          expectedSourceTableNumber: 1,
          expectedDestinationTableNumber: 3,
          expectedDestinationTeamId: null,
        });
        void competingMove.finally(() => {
          competingMoveSettled = true;
        });
        competingMoveWasBlocked =
          relocationPid !== null &&
          (await waitUntilBlockedBy(relocationPid, () => competingMoveSettled));
      });

      const [relocationResult, competingMoveResult] = await Promise.all([
        relocation,
        competingMove,
      ]);

      expect(relocationPid).not.toBeNull();
      expect(competingMoveWasBlocked).toBe(true);
      expect(relocationResult).toEqual({
        ok: true,
        message: "Moved team from table 1 to table 2.",
      });
      expect(competingMoveResult).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: sourceTableId,
          number: 1,
          reserved_by_team_id: null,
          reserved_at: null,
        },
        {
          id: firstTargetId,
          number: 2,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
        {
          id: secondTargetId,
          number: 3,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: "assignment.moved",
        details: {
          fromTableId: sourceTableId,
          toTableId: firstTargetId,
        },
      });
    });

    test("rejects unassign when a concurrent move changed the confirmed source", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent();
      const sourceTableId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000002001",
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const targetTableId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000002002",
        eventId,
        number: 2,
      });
      let relocation!: ReturnType<typeof moveReservationTeam>;
      let unassign!: ReturnType<typeof unassignReservationTeam>;
      let relocationSettled = false;
      let unassignSettled = false;
      let relocationPid: number | null = null;
      let unassignWasBlocked = false;

      await lockSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          SELECT id
          FROM public.tables
          WHERE id = ${targetTableId}::uuid
          FOR UPDATE
        `;

        relocation = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId: targetTableId,
          expectedSourceTableId: sourceTableId,
          expectedSourceTableNumber: 1,
          expectedDestinationTableNumber: 2,
          expectedDestinationTeamId: null,
        });
        void relocation.finally(() => {
          relocationSettled = true;
        });
        relocationPid = await waitForBlockedPid(
          holder.pid,
          () => relocationSettled,
        );

        unassign = unassignReservationTeam({
          eventId,
          teamId: teamAId,
          expectedSourceTableId: sourceTableId,
          expectedSourceTableNumber: 1,
        });
        void unassign.finally(() => {
          unassignSettled = true;
        });
        unassignWasBlocked =
          relocationPid !== null &&
          (await waitUntilBlockedBy(relocationPid, () => unassignSettled));
      });

      const [relocationResult, unassignResult] = await Promise.all([
        relocation,
        unassign,
      ]);

      expect(relocationPid).not.toBeNull();
      expect(unassignWasBlocked).toBe(true);
      expect(relocationResult).toEqual({
        ok: true,
        message: "Moved team from table 1 to table 2.",
      });
      expect(unassignResult).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: sourceTableId,
          number: 1,
          reserved_by_team_id: null,
          reserved_at: null,
        },
        {
          id: targetTableId,
          number: 2,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: "assignment.moved",
        details: {
          teamId: teamAId,
          fromTableId: sourceTableId,
          toTableId: targetTableId,
        },
      });
    });

    test("a blocked selected team does not serialize an unrelated organizer move", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent();
      const blockedTargetId = await addFixtureTable({
        eventId,
        number: 1,
      });
      const unrelatedTargetId = await addFixtureTable({
        eventId,
        number: 2,
      });
      let blockedMove!: ReturnType<typeof moveReservationTeam>;
      let unrelatedMove!: ReturnType<typeof moveReservationTeam>;
      let blockedMoveSettled = false;
      let unrelatedMoveSettled = false;
      let blockedMoveWasBlocked = false;
      let unrelatedMoveSettledBeforeRelease = false;

      await lockSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          SELECT id
          FROM public.tables
          WHERE id = ${blockedTargetId}::uuid
          FOR UPDATE
        `;

        blockedMove = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId: blockedTargetId,
          expectedSourceTableId: null,
          expectedSourceTableNumber: null,
          expectedDestinationTableNumber: 1,
          expectedDestinationTeamId: null,
        });
        void blockedMove.finally(() => {
          blockedMoveSettled = true;
        });
        blockedMoveWasBlocked = await waitUntilBlockedBy(
          holder.pid,
          () => blockedMoveSettled,
        );

        unrelatedMove = moveReservationTeam({
          eventId,
          teamId: teamCId,
          tableId: unrelatedTargetId,
          expectedSourceTableId: null,
          expectedSourceTableNumber: null,
          expectedDestinationTableNumber: 2,
          expectedDestinationTeamId: null,
        });
        void unrelatedMove.finally(() => {
          unrelatedMoveSettled = true;
        });
        unrelatedMoveSettledBeforeRelease = await waitUntilSettled(
          () => unrelatedMoveSettled,
        );
      });

      const [blockedResult, unrelatedResult] = await Promise.all([
        blockedMove,
        unrelatedMove,
      ]);
      expect(blockedMoveWasBlocked).toBe(true);
      expect(unrelatedMoveSettledBeforeRelease).toBe(true);
      expect(blockedResult.ok).toBe(true);
      expect(unrelatedResult.ok).toBe(true);
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: blockedTargetId,
          number: 1,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
        {
          id: unrelatedTargetId,
          number: 2,
          reserved_by_team_id: teamCId,
          reserved_at: expect.any(Date),
        },
      ]);
    });

    test("opposite-team swaps complete without an FK lock deadlock", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent();
      const firstTableId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000003001",
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const secondTableId = await addFixtureTable({
        tableId: "66000000-0000-4000-8000-000000003002",
        eventId,
        number: 2,
        teamId: teamBId,
      });
      let firstSwap!: ReturnType<typeof moveReservationTeam>;
      let secondSwap!: ReturnType<typeof moveReservationTeam>;
      let settledCount = 0;
      let tableLockReadsDispatched = 0;
      let bothTableLockReadsWereDispatched = false;

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
            tableLockReadsDispatched += 1;
          }
        };

        try {
          firstSwap = moveReservationTeam({
            eventId,
            teamId: teamAId,
            tableId: secondTableId,
            expectedSourceTableId: firstTableId,
            expectedSourceTableNumber: 1,
            expectedDestinationTableNumber: 2,
            expectedDestinationTeamId: teamBId,
          });
          secondSwap = moveReservationTeam({
            eventId,
            teamId: teamBId,
            tableId: firstTableId,
            expectedSourceTableId: secondTableId,
            expectedSourceTableNumber: 2,
            expectedDestinationTableNumber: 1,
            expectedDestinationTeamId: teamAId,
          });
          void firstSwap.finally(() => {
            settledCount += 1;
          });
          void secondSwap.finally(() => {
            settledCount += 1;
          });

          const deadline = Date.now() + 2_000;
          while (Date.now() < deadline) {
            if (tableLockReadsDispatched >= 2) {
              bothTableLockReadsWereDispatched = true;
              break;
            }
            if (settledCount > 0) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } finally {
          db.$client.options.debug = previousDebug;
        }
      });

      const results = await Promise.all([firstSwap, secondSwap]);

      expect(bothTableLockReadsWereDispatched).toBe(true);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.filter(
          (result) => result.ok && result.message.startsWith("Swapped teams"),
        ),
      ).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        {
          ok: false,
          error:
            "Assignments changed since this confirmation was opened. Refresh and try again.",
        },
      ]);
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: firstTableId,
          number: 1,
          reserved_by_team_id: teamBId,
          reserved_at: expect.any(Date),
        },
        {
          id: secondTableId,
          number: 2,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: "assignment.swapped",
        entity_type: "assignment",
      });
      expect(new Set(audits[0].details.teamIds as string[])).toEqual(
        new Set([teamAId, teamBId]),
      );
      expect(new Set(audits[0].details.tableIds as string[])).toEqual(
        new Set([firstTableId, secondTableId]),
      );
    });

    test("rejects a confirmed organizer move when a participant claims for that team", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent({ status: "open" });
      const occupiedTargetId = await addFixtureTable({
        eventId,
        number: 1,
        teamId: teamAId,
      });
      const participantTargetId = await addFixtureTable({
        eventId,
        number: 2,
      });
      let organizerMove!: ReturnType<typeof moveReservationTeam>;
      let participantClaim!: ReturnType<typeof reserveTable>;
      let organizerMoveSettled = false;
      let participantClaimSettled = false;
      let organizerPid: number | null = null;
      let participantWasBlockedByOrganizer = false;
      let participantSettledBeforeRelease = false;

      await lockSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          SELECT id
          FROM public.tables
          WHERE id = ${occupiedTargetId}::uuid
          FOR UPDATE
        `;

        organizerMove = moveReservationTeam({
          eventId,
          teamId: teamBId,
          tableId: occupiedTargetId,
          expectedSourceTableId: null,
          expectedSourceTableNumber: null,
          expectedDestinationTableNumber: 1,
          expectedDestinationTeamId: teamAId,
        });
        void organizerMove.finally(() => {
          organizerMoveSettled = true;
        });
        organizerPid = await waitForBlockedPid(
          holder.pid,
          () => organizerMoveSettled,
        );

        participantClaim = reserveTable({ tableId: participantTargetId });
        void participantClaim.finally(() => {
          participantClaimSettled = true;
        });
        participantWasBlockedByOrganizer =
          organizerPid !== null &&
          (await waitUntilBlockedBy(
            organizerPid,
            () => participantClaimSettled,
          ));
        participantSettledBeforeRelease = participantClaimSettled;
      });

      const [organizerResult, participantResult] = await Promise.all([
        organizerMove,
        participantClaim,
      ]);

      expect(organizerPid).not.toBeNull();
      expect(participantWasBlockedByOrganizer).toBe(false);
      expect(participantSettledBeforeRelease).toBe(true);
      expect(participantResult).toEqual({
        ok: true,
        message: "Reserved table 2.",
      });
      expect(organizerResult).toEqual({
        ok: false,
        error:
          "Assignments changed since this confirmation was opened. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: occupiedTargetId,
          number: 1,
          reserved_by_team_id: teamAId,
          reserved_at: new Date("2026-08-25T12:00:00.000Z"),
        },
        {
          id: participantTargetId,
          number: 2,
          reserved_by_team_id: teamBId,
          reserved_at: expect.any(Date),
        },
      ]);
      const audits = await loadAudit(eventId);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        actor_user_id: participantB.id,
        action: "assignment.reserved",
        entity_type: "assignment",
        entity_id: participantTargetId,
        details: {
          tableId: participantTargetId,
          tableNumber: 2,
          teamId: teamBId,
        },
      });
    });

    test("rolls back an assignment when the real audit insert fails", async () => {
      const { eventId } = await createFixtureEvent();
      const tableId = await addFixtureTable({ eventId, number: 1 });
      requireOrganizerMock.mockResolvedValue({
        ...organizer,
        id: randomUUID(),
      });

      const result = await moveReservationTeam({
        eventId,
        teamId: teamAId,
        tableId,
        expectedSourceTableId: null,
        expectedSourceTableNumber: null,
        expectedDestinationTableNumber: 1,
        expectedDestinationTeamId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "A related record no longer exists. Refresh and try again.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: tableId,
          number: 1,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
      expect(await loadAudit(eventId)).toEqual([]);
    });

    test("waits for a lifecycle archive and then rejects assignment", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent({ status: "open" });
      const tableId = await addFixtureTable({ eventId, number: 1 });
      let actionPromise!: ReturnType<typeof moveReservationTeam>;
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
        actionPromise = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId,
          expectedSourceTableId: null,
          expectedSourceTableNumber: null,
          expectedDestinationTableNumber: 1,
          expectedDestinationTeamId: null,
        });
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
        error:
          "Archived events are read-only. Restore the event before editing.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: tableId,
          number: 1,
          reserved_by_team_id: null,
          reserved_at: null,
        },
      ]);
    });

    test("waits for event deletion and then rejects assignment", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent({ status: "closed" });
      const tableId = await addFixtureTable({ eventId, number: 1 });
      let actionPromise!: ReturnType<typeof moveReservationTeam>;
      let actionSettled = false;
      let actionWasBlocked = false;

      await lockSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          DELETE FROM public.events
          WHERE id = ${eventId}::uuid
        `;
        actionPromise = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId,
          expectedSourceTableId: null,
          expectedSourceTableNumber: null,
          expectedDestinationTableNumber: 1,
          expectedDestinationTeamId: null,
        });
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
        error: "That event no longer exists.",
      });
      expect(await loadAssignments(eventId)).toEqual([]);
    });

    test("a blocked organizer move does not serialize a participant on another table", async () => {
      const lockSql = requireLockDatabase();
      const { eventId } = await createFixtureEvent({ status: "open" });
      const blockedTableId = await addFixtureTable({ eventId, number: 1 });
      const participantTableId = await addFixtureTable({
        eventId,
        number: 2,
      });
      let organizerAction!: ReturnType<typeof moveReservationTeam>;
      let participantAction!: ReturnType<typeof reserveTable>;
      let organizerSettled = false;
      let participantSettled = false;
      let organizerWasBlocked = false;
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

        organizerAction = moveReservationTeam({
          eventId,
          teamId: teamAId,
          tableId: blockedTableId,
          expectedSourceTableId: null,
          expectedSourceTableNumber: null,
          expectedDestinationTableNumber: 1,
          expectedDestinationTeamId: null,
        });
        void organizerAction.then(
          () => {
            organizerSettled = true;
          },
          () => {
            organizerSettled = true;
          },
        );
        organizerWasBlocked = await waitUntilBlockedBy(
          holder.pid,
          () => organizerSettled,
        );

        participantAction = reserveTable({ tableId: participantTableId });
        void participantAction.then(
          () => {
            participantSettled = true;
          },
          () => {
            participantSettled = true;
          },
        );
        participantSettledBeforeRelease = await waitUntilSettled(
          () => participantSettled,
        );
      });

      const [organizerResult, participantResult] = await Promise.all([
        organizerAction,
        participantAction,
      ]);
      expect(organizerWasBlocked).toBe(true);
      expect(participantSettledBeforeRelease).toBe(true);
      expect(organizerResult).toEqual({
        ok: true,
        message: "Assigned team to table 1.",
      });
      expect(participantResult).toEqual({
        ok: true,
        message: "Reserved table 2.",
      });
      expect(await loadAssignments(eventId)).toEqual([
        {
          id: blockedTableId,
          number: 1,
          reserved_by_team_id: teamAId,
          reserved_at: expect.any(Date),
        },
        {
          id: participantTableId,
          number: 2,
          reserved_by_team_id: teamBId,
          reserved_at: expect.any(Date),
        },
      ]);
    });
  },
);
