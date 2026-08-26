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
import type { ApplicationDecision } from "@/lib/decisions";
import type { ReservationEventStatus } from "@/lib/reservation/domain";

const { requireSessionUserMock, revalidatePathMock } = vi.hoisted(() => ({
  requireSessionUserMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireSessionUser: requireSessionUserMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { randomlyAssignTable, reserveTable } from "@/lib/actions/reservation";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl
  ? postgres(databaseUrl, { max: 4, prepare: false })
  : null;
const lifecycleDatabase = databaseUrl
  ? postgres(databaseUrl, { max: 1, prepare: false })
  : null;

const teamAId = "63000000-0000-4000-8000-000000000001";
const teamBId = "63000000-0000-4000-8000-000000000002";
const participantA = {
  id: "63000000-0000-4000-8000-000000000101",
  email: "reservation-participant-a@mhacks.test",
  role: "hacker" as const,
  teamId: teamAId,
};
const participantB = {
  id: "63000000-0000-4000-8000-000000000102",
  email: "reservation-participant-b@mhacks.test",
  role: "hacker" as const,
  teamId: teamBId,
};
const participantWithInvalidAuditEmail = {
  ...participantA,
  email: null,
};
const organizer = {
  id: "63000000-0000-4000-8000-000000000103",
  email: "reservation-organizer@mhacks.test",
  role: "organizer" as const,
  teamId: null,
};
const fixtureEventIds = new Set<string>();

function requireDatabase() {
  if (!database) {
    throw new Error("DATABASE_URL is required");
  }
  return database;
}

function requireLifecycleDatabase() {
  if (!lifecycleDatabase) {
    throw new Error("DATABASE_URL is required");
  }
  return lifecycleDatabase;
}

async function waitUntilBlockedBy(
  blockingPid: number,
  actionHasSettled: () => boolean,
): Promise<boolean> {
  return waitUntilBlockedWaiterCount(blockingPid, 1, actionHasSettled);
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

async function removeFixturePrincipals() {
  const sql = requireDatabase();
  await sql`
    DELETE FROM public.users
    WHERE id IN (
      ${participantA.id}::uuid,
      ${participantB.id}::uuid,
      ${organizer.id}::uuid
    )
  `;
  await sql`
    DELETE FROM public.teams
    WHERE id IN (${teamAId}::uuid, ${teamBId}::uuid)
  `;
}

async function setApplicationDecision(
  userId: string,
  decision: ApplicationDecision,
) {
  const sql = requireDatabase();
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
      ${userId}::uuid,
      ${decision}::public.application_decision,
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
    ON CONFLICT (user_id) DO UPDATE
    SET decision = excluded.decision
  `;
}

async function createEvent({
  status = "open",
  reservationsOpenAt = null,
  reservationsCloseAt = null,
  tableCount = 1,
}: {
  status?: ReservationEventStatus;
  reservationsOpenAt?: Date | null;
  reservationsCloseAt?: Date | null;
  tableCount?: number;
} = {}) {
  const sql = requireDatabase();
  const eventId = randomUUID();
  const eventName = `Participant action ${eventId}`;
  fixtureEventIds.add(eventId);

  await sql`
    INSERT INTO public.events (
      id,
      name,
      status,
      reservations_open_at,
      reservations_close_at
    )
    VALUES (
      ${eventId}::uuid,
      ${eventName},
      ${status}::public.reservation_event_status,
      ${reservationsOpenAt},
      ${reservationsCloseAt}
    )
  `;

  const tableIds: string[] = [];
  for (let number = 1; number <= tableCount; number += 1) {
    const tableId = randomUUID();
    tableIds.push(tableId);
    await sql`
      INSERT INTO public.tables (id, event_id, number)
      VALUES (${tableId}::uuid, ${eventId}::uuid, ${number})
    `;
  }

  return { eventId, eventName, tableIds };
}

async function removeFixtureEvents() {
  const sql = requireDatabase();
  for (const eventId of fixtureEventIds) {
    await sql`DELETE FROM public.events WHERE id = ${eventId}::uuid`;
  }
  fixtureEventIds.clear();
}

type EventFixture = Awaited<ReturnType<typeof createEvent>>;

const participantActionCases = [
  {
    label: "direct",
    run: ({ tableIds }: EventFixture) => reserveTable({ tableId: tableIds[0] }),
    auditFailureError: "Could not reserve that table. Try again.",
  },
  {
    label: "random",
    run: ({ eventId }: EventFixture) => randomlyAssignTable({ eventId }),
    auditFailureError: "Could not assign a table. Try again.",
  },
] as const;

describe.skipIf(!databaseUrl)("participant reservation actions", () => {
  beforeAll(async () => {
    const sql = requireDatabase();
    await removeFixturePrincipals();
    await sql`
      INSERT INTO public.teams (id, name)
      VALUES
        (${teamAId}::uuid, 'Participant action team A'),
        (${teamBId}::uuid, 'Participant action team B')
    `;
    await sql`
      INSERT INTO public.users (id, email, role, team_id)
      VALUES
        (
          ${participantA.id}::uuid,
          ${participantA.email},
          ${participantA.role},
          ${participantA.teamId}::uuid
        ),
        (
          ${participantB.id}::uuid,
          ${participantB.email},
          ${participantB.role},
          ${participantB.teamId}::uuid
        ),
        (
          ${organizer.id}::uuid,
          ${organizer.email},
          ${organizer.role},
          NULL
        )
    `;
  });

  beforeEach(async () => {
    requireSessionUserMock.mockReset();
    revalidatePathMock.mockReset();
    await setApplicationDecision(participantA.id, "early_accepted");
    await setApplicationDecision(participantB.id, "regular_accepted");
  });

  afterEach(removeFixtureEvents);

  afterAll(async () => {
    if (!database) return;
    await removeFixtureEvents();
    await removeFixturePrincipals();
    await lifecycleDatabase?.end({ timeout: 5 });
    await database.end({ timeout: 5 });
  });

  test("uses the active user's team and audits a direct reservation", async () => {
    const sql = requireDatabase();
    const { eventId, eventName, tableIds } = await createEvent();
    requireSessionUserMock.mockResolvedValue(participantA);

    const result = await reserveTable({ tableId: tableIds[0] });

    expect(result).toEqual({ ok: true, message: "Reserved table 1." });
    const assignmentRows = await sql<
      { reserved_by_team_id: string; reserved_at: Date }[]
    >`
      SELECT reserved_by_team_id::text, reserved_at
      FROM public.tables
      WHERE id = ${tableIds[0]}::uuid
    `;
    expect(assignmentRows).toHaveLength(1);
    expect(assignmentRows[0].reserved_by_team_id).toBe(teamAId);
    expect(assignmentRows[0].reserved_at).toBeInstanceOf(Date);

    const auditRows = await sql<
      {
        event_name: string;
        actor_user_id: string;
        actor_email: string;
        action: string;
        entity_type: string;
        entity_id: string;
        details: Record<string, unknown>;
      }[]
    >`
      SELECT
        event_name,
        actor_user_id::text,
        actor_email,
        action,
        entity_type,
        entity_id::text,
        details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(auditRows).toEqual([
      {
        event_name: eventName,
        actor_user_id: participantA.id,
        actor_email: participantA.email,
        action: "assignment.reserved",
        entity_type: "assignment",
        entity_id: tableIds[0],
        details: {
          tableId: tableIds[0],
          tableNumber: 1,
          teamId: teamAId,
        },
      },
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/reserve");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/reservations");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/reservations/${eventId}/assignments`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/reservations/${eventId}/audit`,
    );
  });

  test("rejects organizers from direct and random reservations", async () => {
    const { eventId, tableIds } = await createEvent();
    requireSessionUserMock.mockResolvedValue(organizer);

    await expect(reserveTable({ tableId: tableIds[0] })).resolves.toEqual({
      ok: false,
      error: "Organizers cannot reserve tables.",
    });
    await expect(randomlyAssignTable({ eventId })).resolves.toEqual({
      ok: false,
      error: "Organizers cannot reserve tables.",
    });
  });

  test.each([null, "applied", "early_rejected", "regular_rejected"] as const)(
    "rejects direct and random reservations for decision %s",
    async (decision) => {
      const sql = requireDatabase();
      const fixture = await createEvent();
      requireSessionUserMock.mockResolvedValue(participantA);
      if (decision === null) {
        await sql`
        DELETE FROM public.hacker_applicants
        WHERE user_id = ${participantA.id}::uuid
      `;
      } else {
        await setApplicationDecision(participantA.id, decision);
      }

      const expected = {
        ok: false as const,
        error:
          "An accepted MHacks 2026 application is required to reserve a table.",
      };
      await expect(
        reserveTable({ tableId: fixture.tableIds[0] }),
      ).resolves.toEqual(expected);
      await expect(
        randomlyAssignTable({ eventId: fixture.eventId }),
      ).resolves.toEqual(expected);

      const [assignment] = await sql<
        { reserved_by_team_id: string | null; reserved_at: Date | null }[]
      >`
      SELECT reserved_by_team_id::text, reserved_at
      FROM public.tables
      WHERE id = ${fixture.tableIds[0]}::uuid
    `;
      expect(assignment).toEqual({
        reserved_by_team_id: null,
        reserved_at: null,
      });
      const [audit] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${fixture.eventId}::uuid
    `;
      expect(audit.count).toBe(0);
    },
  );

  test.each([
    "early_accepted",
    "early_rsvped",
    "regular_accepted",
    "regular_rsvped",
  ] as const)("allows reservation for decision %s", async (decision) => {
    const fixture = await createEvent();
    requireSessionUserMock.mockResolvedValue(participantA);
    await setApplicationDecision(participantA.id, decision);

    await expect(
      reserveTable({ tableId: fixture.tableIds[0] }),
    ).resolves.toEqual({ ok: true, message: "Reserved table 1." });
  });

  test.each(participantActionCases)(
    "$label reservation waits for a rejection decision and then denies access",
    async ({ run }) => {
      const sql = requireDatabase();
      const decisionSql = requireLifecycleDatabase();
      const fixture = await createEvent();
      requireSessionUserMock.mockResolvedValue(participantA);

      let actionPromise!: ReturnType<typeof reserveTable>;
      let actionSettled = false;
      let actionWasBlocked = false;

      await decisionSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          UPDATE public.hacker_applicants
          SET decision = 'regular_rejected'
          WHERE user_id = ${participantA.id}::uuid
        `;

        actionPromise = run(fixture);
        void actionPromise.finally(() => {
          actionSettled = true;
        });
        actionWasBlocked = await waitUntilBlockedBy(
          holder.pid,
          () => actionSettled,
        );
      });

      expect(actionWasBlocked).toBe(true);
      await expect(actionPromise).resolves.toEqual({
        ok: false,
        error:
          "An accepted MHacks 2026 application is required to reserve a table.",
      });
      const [assignment] = await sql<
        { reserved_by_team_id: string | null; reserved_at: Date | null }[]
      >`
        SELECT reserved_by_team_id::text, reserved_at
        FROM public.tables
        WHERE id = ${fixture.tableIds[0]}::uuid
      `;
      expect(assignment).toEqual({
        reserved_by_team_id: null,
        reserved_at: null,
      });
      const [audit] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM public.reservation_audit_log
        WHERE event_id = ${fixture.eventId}::uuid
      `;
      expect(audit.count).toBe(0);
    },
  );

  test("rejects malformed participant selections before database access", async () => {
    requireSessionUserMock.mockResolvedValue(participantA);

    await expect(reserveTable({ tableId: "not-a-uuid" })).resolves.toEqual({
      ok: false,
      error: "Select a valid table and try again.",
    });
    await expect(
      randomlyAssignTable({ eventId: "not-a-uuid" }),
    ).resolves.toEqual({
      ok: false,
      error: "Select a valid event and try again.",
    });
  });

  test.each([
    {
      label: "draft",
      status: "draft" as const,
      opensInMs: null,
      closesInMs: null,
    },
    {
      label: "closed",
      status: "closed" as const,
      opensInMs: null,
      closesInMs: null,
    },
    {
      label: "archived",
      status: "archived" as const,
      opensInMs: null,
      closesInMs: null,
    },
    {
      label: "not-yet-open",
      status: "open" as const,
      opensInMs: 86_400_000,
      closesInMs: null,
    },
    {
      label: "closed-by-time",
      status: "open" as const,
      opensInMs: null,
      closesInMs: -86_400_000,
    },
  ])(
    "rejects direct and random reservations for a $label event",
    async ({ status, opensInMs, closesInMs }) => {
      const sql = requireDatabase();
      const now = Date.now();
      const { eventId, tableIds } = await createEvent({
        status,
        reservationsOpenAt:
          opensInMs === null ? null : new Date(now + opensInMs),
        reservationsCloseAt:
          closesInMs === null ? null : new Date(now + closesInMs),
      });
      requireSessionUserMock.mockResolvedValue(participantA);

      const expected = {
        ok: false as const,
        error: "Reservations are not open for this event.",
      };
      await expect(reserveTable({ tableId: tableIds[0] })).resolves.toEqual(
        expected,
      );
      await expect(randomlyAssignTable({ eventId })).resolves.toEqual(expected);

      const [assignment] = await sql<
        { reserved_by_team_id: string | null; reserved_at: Date | null }[]
      >`
        SELECT reserved_by_team_id::text, reserved_at
        FROM public.tables
        WHERE id = ${tableIds[0]}::uuid
      `;
      expect(assignment).toEqual({
        reserved_by_team_id: null,
        reserved_at: null,
      });
      const [audit] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM public.reservation_audit_log
        WHERE event_id = ${eventId}::uuid
      `;
      expect(audit.count).toBe(0);
    },
  );

  test.each(participantActionCases)(
    "$label reservation waits for a lifecycle close and then rejects",
    async ({ run }) => {
      const sql = requireDatabase();
      const lifecycleSql = requireLifecycleDatabase();
      const fixture = await createEvent();
      requireSessionUserMock.mockResolvedValue(participantA);

      let actionPromise!: ReturnType<typeof reserveTable>;
      let actionSettled = false;
      let actionWasBlocked = false;

      await lifecycleSql.begin(async (transaction) => {
        const [holder] = await transaction<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        await transaction`
          UPDATE public.events
          SET status = 'closed', updated_at = now()
          WHERE id = ${fixture.eventId}::uuid
        `;

        actionPromise = run(fixture);
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
        error: "Reservations are not open for this event.",
      });
      const [event] = await sql<{ status: string }[]>`
        SELECT status::text
        FROM public.events
        WHERE id = ${fixture.eventId}::uuid
      `;
      expect(event.status).toBe("closed");
      const [assignment] = await sql<
        { reserved_by_team_id: string | null; reserved_at: Date | null }[]
      >`
        SELECT reserved_by_team_id::text, reserved_at
        FROM public.tables
        WHERE id = ${fixture.tableIds[0]}::uuid
      `;
      expect(assignment).toEqual({
        reserved_by_team_id: null,
        reserved_at: null,
      });
      const [audit] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM public.reservation_audit_log
        WHERE event_id = ${fixture.eventId}::uuid
      `;
      expect(audit.count).toBe(0);
    },
  );

  test("direct participant claims share the event lock", async () => {
    const sql = requireDatabase();
    const lifecycleSql = requireLifecycleDatabase();
    const fixture = await createEvent({ tableCount: 2 });
    requireSessionUserMock
      .mockResolvedValueOnce(participantA)
      .mockResolvedValueOnce(participantB);

    let firstAction!: ReturnType<typeof reserveTable>;
    let secondAction!: ReturnType<typeof reserveTable>;
    let firstSettled = false;
    let secondSettled = false;
    let firstBlockedOnTable = false;
    let secondSettledBeforeTableRelease = false;

    await lifecycleSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT id
        FROM public.tables
        WHERE id = ${fixture.tableIds[0]}::uuid
        FOR UPDATE
      `;

      firstAction = reserveTable({ tableId: fixture.tableIds[0] });
      void firstAction.then(
        () => {
          firstSettled = true;
        },
        () => {
          firstSettled = true;
        },
      );
      firstBlockedOnTable = await waitUntilBlockedBy(
        holder.pid,
        () => firstSettled,
      );

      secondAction = reserveTable({ tableId: fixture.tableIds[1] });
      void secondAction.then(
        () => {
          secondSettled = true;
        },
        () => {
          secondSettled = true;
        },
      );
      secondSettledBeforeTableRelease = await waitUntilSettled(
        () => secondSettled,
      );
    });

    const results = await Promise.all([firstAction, secondAction]);

    expect(firstBlockedOnTable).toBe(true);
    expect(secondSettledBeforeTableRelease).toBe(true);
    expect(results.every((result) => result.ok)).toBe(true);
    const assignments = await sql<
      { number: number; reserved_by_team_id: string | null }[]
    >`
      SELECT number, reserved_by_team_id::text
      FROM public.tables
      WHERE event_id = ${fixture.eventId}::uuid
      ORDER BY number
    `;
    expect(assignments).toEqual([
      { number: 1, reserved_by_team_id: teamAId },
      { number: 2, reserved_by_team_id: teamBId },
    ]);
    const [audit] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${fixture.eventId}::uuid
    `;
    expect(audit.count).toBe(2);
  });

  test("random and direct participant claims share the event lock", async () => {
    const sql = requireDatabase();
    const lifecycleSql = requireLifecycleDatabase();
    const fixture = await createEvent({ tableCount: 2 });
    await sql`
      UPDATE public.tables
      SET reserved_by_team_id = ${teamBId}::uuid, reserved_at = now()
      WHERE id = ${fixture.tableIds[1]}::uuid
    `;
    requireSessionUserMock
      .mockResolvedValueOnce(participantA)
      .mockResolvedValueOnce(participantB);

    let firstAction!: ReturnType<typeof randomlyAssignTable>;
    let secondAction!: ReturnType<typeof reserveTable>;
    let firstSettled = false;
    let secondSettled = false;
    let firstBlockedOnTable = false;
    let secondSettledBeforeTableRelease = false;

    await lifecycleSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT id
        FROM public.tables
        WHERE id = ${fixture.tableIds[0]}::uuid
        FOR UPDATE
      `;

      firstAction = randomlyAssignTable({ eventId: fixture.eventId });
      void firstAction.then(
        () => {
          firstSettled = true;
        },
        () => {
          firstSettled = true;
        },
      );
      firstBlockedOnTable = await waitUntilBlockedBy(
        holder.pid,
        () => firstSettled,
      );

      await sql`
        UPDATE public.tables
        SET reserved_by_team_id = NULL, reserved_at = NULL
        WHERE id = ${fixture.tableIds[1]}::uuid
      `;
      secondAction = reserveTable({ tableId: fixture.tableIds[1] });
      void secondAction.then(
        () => {
          secondSettled = true;
        },
        () => {
          secondSettled = true;
        },
      );
      secondSettledBeforeTableRelease = await waitUntilSettled(
        () => secondSettled,
      );
    });

    const results = await Promise.all([firstAction, secondAction]);

    expect(firstBlockedOnTable).toBe(true);
    expect(secondSettledBeforeTableRelease).toBe(true);
    expect(results.every((result) => result.ok)).toBe(true);
    const assignments = await sql<{ reserved_by_team_id: string | null }[]>`
      SELECT reserved_by_team_id::text
      FROM public.tables
      WHERE event_id = ${fixture.eventId}::uuid
      ORDER BY number
    `;
    expect(new Set(assignments.map((row) => row.reserved_by_team_id))).toEqual(
      new Set([teamAId, teamBId]),
    );
    const [audit] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${fixture.eventId}::uuid
    `;
    expect(audit.count).toBe(2);
  });

  test.each(participantActionCases)(
    "rolls back a $label claim when the real audit insert fails",
    async ({ run, auditFailureError }) => {
      const sql = requireDatabase();
      const fixture = await createEvent();
      requireSessionUserMock.mockResolvedValue(
        participantWithInvalidAuditEmail,
      );

      const result = await run(fixture);

      expect(result).toEqual({ ok: false, error: auditFailureError });
      const [assignment] = await sql<
        { reserved_by_team_id: string | null; reserved_at: Date | null }[]
      >`
        SELECT reserved_by_team_id::text, reserved_at
        FROM public.tables
        WHERE id = ${fixture.tableIds[0]}::uuid
      `;
      expect(assignment).toEqual({
        reserved_by_team_id: null,
        reserved_at: null,
      });
      const [audit] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM public.reservation_audit_log
        WHERE event_id = ${fixture.eventId}::uuid
      `;
      expect(audit.count).toBe(0);
    },
  );

  test("audits a successful random reservation", async () => {
    const sql = requireDatabase();
    const { eventId, tableIds } = await createEvent();
    requireSessionUserMock.mockResolvedValue(participantA);

    const result = await randomlyAssignTable({ eventId });

    expect(result).toEqual({ ok: true, message: "Assigned table 1." });
    const [assignment] = await sql<
      { reserved_by_team_id: string; reserved_at: Date }[]
    >`
      SELECT reserved_by_team_id::text, reserved_at
      FROM public.tables
      WHERE id = ${tableIds[0]}::uuid
    `;
    expect(assignment.reserved_by_team_id).toBe(teamAId);
    expect(assignment.reserved_at).toBeInstanceOf(Date);

    const auditRows = await sql<
      { action: string; entity_id: string; details: Record<string, unknown> }[]
    >`
      SELECT action, entity_id::text, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(auditRows).toEqual([
      {
        action: "assignment.randomly_reserved",
        entity_id: tableIds[0],
        details: {
          tableId: tableIds[0],
          tableNumber: 1,
          teamId: teamAId,
        },
      },
    ]);
  });

  test("returns the stable taken error for concurrent direct claims", async () => {
    const sql = requireDatabase();
    const { eventId, tableIds } = await createEvent();
    requireSessionUserMock
      .mockResolvedValueOnce(participantA)
      .mockResolvedValueOnce(participantB);

    const results = await Promise.all([
      reserveTable({ tableId: tableIds[0] }),
      reserveTable({ tableId: tableIds[0] }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: "That table was just taken. Pick another." },
    ]);
    const [audit] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(audit.count).toBe(1);
  });

  test("returns the stable full error for concurrent random claims", async () => {
    const sql = requireDatabase();
    const { eventId } = await createEvent();
    requireSessionUserMock
      .mockResolvedValueOnce(participantA)
      .mockResolvedValueOnce(participantB);

    const results = await Promise.all([
      randomlyAssignTable({ eventId }),
      randomlyAssignTable({ eventId }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: "No open tables left for this event." },
    ]);
    const [audit] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(audit.count).toBe(1);
  });
});
