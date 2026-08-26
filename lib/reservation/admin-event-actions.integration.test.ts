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
import { db } from "@/lib/db";
import type { ReservationEventStatus } from "@/lib/reservation/domain";
import type { ReservationEventInput } from "@/lib/reservation/validation";

const { requireOrganizerMock, revalidatePathMock } = vi.hoisted(() => ({
  requireOrganizerMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOrganizer: requireOrganizerMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  archiveReservationEvent,
  createReservationEvent,
  deleteReservationEvent,
  restoreReservationEvent,
  updateReservationEvent,
} from "@/lib/actions/admin-reservations.server.actions";
import {
  getAdminReservationEvent,
  getReservationAuditPage,
  listAdminReservationEvents,
  toAdminReservationEventListItem,
} from "@/lib/queries/admin-reservations";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl
  ? postgres(databaseUrl, { max: 4, prepare: false })
  : null;
const lockDatabase = databaseUrl
  ? postgres(databaseUrl, { max: 1, prepare: false })
  : null;

const organizer = {
  id: "64000000-0000-4000-8000-000000000101",
  email: "reservation-event-organizer@mhacks.test",
  role: "organizer" as const,
  teamId: null,
};
const assignedTeamId = "64000000-0000-4000-8000-000000000001";
const secondAssignedTeamId = "64000000-0000-4000-8000-000000000002";
const fixtureEventIds = new Set<string>();

function requireDatabase() {
  if (!database) throw new Error("DATABASE_URL is required");
  return database;
}

function requireLockDatabase() {
  if (!lockDatabase) throw new Error("DATABASE_URL is required");
  return lockDatabase;
}

function eventValues(
  overrides: Partial<ReservationEventInput> = {},
): ReservationEventInput {
  return {
    name: `Organizer event ${randomUUID()}`,
    description: "An organizer-managed reservation event.",
    location: "Duderstadt Center",
    startsAt: new Date("2026-10-04T14:00:00.000Z"),
    status: "draft",
    reservationsOpenAt: null,
    reservationsCloseAt: null,
    ...overrides,
  };
}

async function createFixtureEvent({
  name = `Organizer fixture ${randomUUID()}`,
  description = "Before description",
  location = "Before location",
  status = "draft",
  startsAt = new Date("2026-10-04T14:00:00.000Z"),
  reservationsOpenAt = null,
  reservationsCloseAt = null,
}: {
  name?: string;
  description?: string | null;
  location?: string | null;
  status?: ReservationEventStatus;
  startsAt?: Date | null;
  reservationsOpenAt?: Date | null;
  reservationsCloseAt?: Date | null;
} = {}) {
  const sql = requireDatabase();
  const eventId = randomUUID();
  fixtureEventIds.add(eventId);
  await sql`
    INSERT INTO public.events (
      id,
      name,
      description,
      location,
      status,
      starts_at,
      reservations_open_at,
      reservations_close_at
    )
    VALUES (
      ${eventId}::uuid,
      ${name},
      ${description},
      ${location},
      ${status}::public.reservation_event_status,
      ${startsAt},
      ${reservationsOpenAt},
      ${reservationsCloseAt}
    )
  `;
  return { eventId, eventName: name };
}

async function addFixtureTable({
  eventId,
  number,
  teamId = null,
}: {
  eventId: string;
  number: number;
  teamId?: string | null;
}) {
  const sql = requireDatabase();
  const tableId = randomUUID();
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

async function removeFixtureEvents() {
  const sql = requireDatabase();
  for (const eventId of fixtureEventIds) {
    await sql`DELETE FROM public.events WHERE id = ${eventId}::uuid`;
  }
  fixtureEventIds.clear();
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

function insertAuditInSeparateProcess({
  auditId,
  eventId,
  eventName,
  action,
  details,
  createdAt,
}: {
  auditId: string;
  eventId: string;
  eventName: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
}) {
  const script = `
    import postgres from "postgres";
    const sql = postgres(process.env.DATABASE_URL, { prepare: false });
    try {
      await sql.unsafe(
        \`INSERT INTO public.reservation_audit_log (
          id,
          event_id,
          event_name,
          actor_user_id,
          actor_email,
          action,
          entity_type,
          entity_id,
          details,
          created_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4::uuid,
          $5,
          $6,
          'event',
          $2::uuid,
          $7::jsonb,
          $8::timestamptz
        )\`,
        [
          process.env.AUDIT_ID,
          process.env.EVENT_ID,
          process.env.EVENT_NAME,
          process.env.ACTOR_ID,
          process.env.ACTOR_EMAIL,
          process.env.AUDIT_ACTION,
          process.env.AUDIT_DETAILS,
          process.env.AUDIT_CREATED_AT,
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
      AUDIT_ID: auditId,
      EVENT_ID: eventId,
      EVENT_NAME: eventName,
      ACTOR_ID: organizer.id,
      ACTOR_EMAIL: organizer.email,
      AUDIT_ACTION: action,
      AUDIT_DETAILS: JSON.stringify(details),
      AUDIT_CREATED_AT: createdAt.toISOString(),
    },
    stdio: "pipe",
    timeout: 10_000,
  });
}

const invalidSchedule = eventValues({
  name: "",
  reservationsOpenAt: new Date("2026-10-04T13:00:00.000Z"),
  reservationsCloseAt: new Date("2026-10-04T12:00:00.000Z"),
});

const organizerEntryPoints = [
  {
    label: "listAdminReservationEvents",
    run: () => listAdminReservationEvents(),
  },
  {
    label: "getAdminReservationEvent",
    run: () => getAdminReservationEvent("not-a-uuid"),
  },
  {
    label: "getReservationAuditPage",
    run: () => getReservationAuditPage({ eventId: "not-a-uuid" }),
  },
  {
    label: "createReservationEvent",
    run: () => createReservationEvent(invalidSchedule),
  },
  {
    label: "updateReservationEvent",
    run: () =>
      updateReservationEvent({
        eventId: "not-a-uuid",
        values: eventValues(),
      }),
  },
  {
    label: "archiveReservationEvent",
    run: () => archiveReservationEvent("not-a-uuid"),
  },
  {
    label: "restoreReservationEvent",
    run: () => restoreReservationEvent("not-a-uuid"),
  },
  {
    label: "deleteReservationEvent",
    run: () => deleteReservationEvent("not-a-uuid"),
  },
] as const;

describe.skipIf(!databaseUrl)("organizer reservation event backends", () => {
  beforeAll(async () => {
    const sql = requireDatabase();
    await sql`
      DELETE FROM public.users
      WHERE id = ${organizer.id}::uuid
    `;
    await sql`
      DELETE FROM public.teams
      WHERE id IN (${assignedTeamId}::uuid, ${secondAssignedTeamId}::uuid)
    `;
    await sql`
      INSERT INTO public.teams (id, name)
      VALUES
        (
          ${assignedTeamId}::uuid,
          'Organizer event assigned team'
        ),
        (
          ${secondAssignedTeamId}::uuid,
          'Organizer event second assigned team'
        )
    `;
    await sql`
      INSERT INTO public.users (id, email, role, team_id)
      VALUES (
        ${organizer.id}::uuid,
        ${organizer.email},
        ${organizer.role},
        NULL
      )
    `;
  });

  beforeEach(() => {
    requireOrganizerMock.mockReset();
    requireOrganizerMock.mockResolvedValue(organizer);
    revalidatePathMock.mockReset();
  });

  afterEach(removeFixtureEvents);

  afterAll(async () => {
    if (!database) return;
    await removeFixtureEvents();
    const sql = requireDatabase();
    await sql`
      DELETE FROM public.users
      WHERE id = ${organizer.id}::uuid
    `;
    await sql`
      DELETE FROM public.teams
      WHERE id IN (${assignedTeamId}::uuid, ${secondAssignedTeamId}::uuid)
    `;
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

  test("lists and loads event details with table and assignment counts", async () => {
    const startsAt = new Date("2026-11-01T16:00:00.000Z");
    const { eventId, eventName } = await createFixtureEvent({
      startsAt,
      status: "open",
    });
    await addFixtureTable({ eventId, number: 1, teamId: assignedTeamId });
    await addFixtureTable({ eventId, number: 2 });

    const summaries = await listAdminReservationEvents();
    const detail = await getAdminReservationEvent(eventId);

    expect(summaries.find((event) => event.id === eventId)).toEqual({
      id: eventId,
      name: eventName,
      status: "open",
      startsAt,
      reservationsOpenAt: null,
      reservationsCloseAt: null,
      tableCount: 2,
      assignedCount: 1,
      reservationAvailability: { state: "open", canReserve: true },
    });
    expect(detail).toMatchObject({
      id: eventId,
      name: eventName,
      description: "Before description",
      location: "Before location",
      status: "open",
      tableCount: 2,
      assignedCount: 1,
    });
    expect(detail?.createdAt).toBeInstanceOf(Date);
    expect(detail?.updatedAt).toBeInstanceOf(Date);
    await expect(getAdminReservationEvent("not-a-uuid")).resolves.toBeNull();
    await expect(getAdminReservationEvent(randomUUID())).resolves.toBeNull();
  });

  test("derives authoritative availability at opening and closing boundaries", () => {
    const opensAt = new Date("2026-10-04T12:00:00.000Z");
    const closesAt = new Date("2026-10-04T13:00:00.000Z");
    const summary = {
      id: randomUUID(),
      name: "Boundary event",
      status: "open" as const,
      startsAt: null,
      reservationsOpenAt: opensAt,
      reservationsCloseAt: closesAt,
      tableCount: 0,
      assignedCount: 0,
    };

    expect(toAdminReservationEventListItem).toBeTypeOf("function");
    expect(
      toAdminReservationEventListItem(
        summary,
        new Date("2026-10-04T11:59:59.999Z"),
      ).reservationAvailability,
    ).toEqual({
      state: "scheduled",
      canReserve: false,
      boundary: opensAt,
    });
    expect(
      toAdminReservationEventListItem(summary, opensAt).reservationAvailability,
    ).toEqual({ state: "open", canReserve: true });
    expect(
      toAdminReservationEventListItem(summary, closesAt)
        .reservationAvailability,
    ).toEqual({ state: "closed", canReserve: false });
  });

  test("returns filtered audit pages newest first with snapshot fields", async () => {
    const sql = requireDatabase();
    const { eventId, eventName } = await createFixtureEvent();
    const olderId = randomUUID();
    const newerId = randomUUID();
    await sql`
      INSERT INTO public.reservation_audit_log (
        id,
        event_id,
        event_name,
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        details,
        created_at
      )
      VALUES
        (
          ${olderId}::uuid,
          ${eventId}::uuid,
          ${eventName},
          ${organizer.id}::uuid,
          ${organizer.email},
          'event.older',
          'event',
          ${eventId}::uuid,
          ${JSON.stringify({ version: 1 })}::jsonb,
          '2026-08-25T18:00:00.000Z'
        ),
        (
          ${newerId}::uuid,
          ${eventId}::uuid,
          ${eventName},
          ${organizer.id}::uuid,
          ${organizer.email},
          'event.newer',
          'event',
          ${eventId}::uuid,
          ${JSON.stringify({ version: 2 })}::jsonb,
          '2026-08-25T19:00:00.000Z'
        )
    `;

    const firstPage = await getReservationAuditPage({
      eventId,
      pageIndex: 0,
      pageSize: 1,
    });
    const secondPage = await getReservationAuditPage({
      eventId,
      pageIndex: 1,
      pageSize: 1,
    });

    expect(firstPage).toEqual({
      items: [
        {
          id: newerId,
          eventId,
          eventName,
          actorUserId: organizer.id,
          actorEmail: organizer.email,
          action: "event.newer",
          entityType: "event",
          entityId: eventId,
          details: { version: 2 },
          createdAt: new Date("2026-08-25T19:00:00.000Z"),
        },
      ],
      totalItems: 2,
      pageIndex: 0,
      pageSize: 1,
    });
    expect(secondPage.items.map((item) => item.id)).toEqual([olderId]);
    expect(secondPage.totalItems).toBe(2);
    await expect(
      getReservationAuditPage({ eventId: "not-a-uuid" }),
    ).resolves.toEqual({
      items: [],
      totalItems: 0,
      pageIndex: 0,
      pageSize: 20,
    });
  });

  test("returns audit count and items from one repeatable-read snapshot", async () => {
    const sql = requireDatabase();
    const { eventId, eventName } = await createFixtureEvent();
    const existingAuditId = randomUUID();
    const concurrentAuditId = randomUUID();
    await sql`
      INSERT INTO public.reservation_audit_log (
        id,
        event_id,
        event_name,
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        details,
        created_at
      )
      VALUES (
        ${existingAuditId}::uuid,
        ${eventId}::uuid,
        ${eventName},
        ${organizer.id}::uuid,
        ${organizer.email},
        'event.snapshot_before',
        'event',
        ${eventId}::uuid,
        ${JSON.stringify({ version: 1 })}::jsonb,
        '2026-08-25T20:00:00.000Z'
      )
    `;

    const previousDebug = db.$client.options.debug;
    let concurrentAuditCommitted = false;
    db.$client.options.debug = (_connection, query) => {
      if (
        concurrentAuditCommitted ||
        !query.includes('from "reservation_audit_log"') ||
        !query.includes('"details"') ||
        !query.includes("order by")
      ) {
        return;
      }

      insertAuditInSeparateProcess({
        auditId: concurrentAuditId,
        eventId,
        eventName,
        action: "event.snapshot_during",
        details: { version: 2 },
        createdAt: new Date("2026-08-25T21:00:00.000Z"),
      });
      concurrentAuditCommitted = true;
    };

    try {
      const page = await getReservationAuditPage({
        eventId,
        pageIndex: 0,
        pageSize: 10,
      });

      expect(concurrentAuditCommitted).toBe(true);
      expect(page.totalItems).toBe(page.items.length);
      expect(page.totalItems).toBe(1);
      expect(page.items.map((item) => item.id)).toEqual([existingAuditId]);
    } finally {
      db.$client.options.debug = previousDebug;
    }

    const [committedCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(committedCount.count).toBe(2);
  });

  test("creates a validated event and immutable event.created audit", async () => {
    const sql = requireDatabase();
    const values = eventValues({
      name: "  Final judging  ",
      description: "",
      location: "  Michigan Union  ",
      startsAt: "2026-10-04T14:00:00.000Z",
      status: "open",
      reservationsOpenAt: "2026-10-04T12:00:00.000Z",
      reservationsCloseAt: "2026-10-04T16:00:00.000Z",
    });

    const result = await createReservationEvent(values);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error("Expected created event");
    const { eventId } = result.data;
    fixtureEventIds.add(eventId);
    expect(result).toEqual({
      ok: true,
      message: "Event created.",
      data: { eventId },
    });
    const [event] = await sql<
      {
        name: string;
        description: string | null;
        location: string | null;
        status: string;
        starts_at: Date;
        reservations_open_at: Date;
        reservations_close_at: Date;
      }[]
    >`
      SELECT
        name,
        description,
        location,
        status::text,
        starts_at,
        reservations_open_at,
        reservations_close_at
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    expect(event).toEqual({
      name: "Final judging",
      description: null,
      location: "Michigan Union",
      status: "open",
      starts_at: new Date("2026-10-04T14:00:00.000Z"),
      reservations_open_at: new Date("2026-10-04T12:00:00.000Z"),
      reservations_close_at: new Date("2026-10-04T16:00:00.000Z"),
    });
    const [audit] = await sql<
      {
        event_name: string;
        actor_user_id: string;
        actor_email: string;
        action: string;
        entity_type: string;
        entity_id: string;
        details: { after: Record<string, unknown> };
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
    expect(audit).toMatchObject({
      event_name: "Final judging",
      actor_user_id: organizer.id,
      actor_email: organizer.email,
      action: "event.created",
      entity_type: "event",
      entity_id: eventId,
      details: {
        after: {
          id: eventId,
          name: "Final judging",
          status: "open",
          reservationsOpenAt: "2026-10-04T12:00:00.000Z",
          reservationsCloseAt: "2026-10-04T16:00:00.000Z",
        },
      },
    });
  });

  test("returns schedule field errors without writing an event", async () => {
    const sql = requireDatabase();
    const name = `Invalid schedule ${randomUUID()}`;

    const result = await createReservationEvent(
      eventValues({
        name,
        reservationsOpenAt: "2026-10-04T13:00:00.000Z",
        reservationsCloseAt: "2026-10-04T12:00:00.000Z",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: {
        reservationsCloseAt: ["Closing time must be after opening time."],
      },
    });
    const [eventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.events
      WHERE name = ${name}
    `;
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_name = ${name}
    `;
    expect(eventCount.count).toBe(0);
    expect(auditCount.count).toBe(0);
  });

  test("updates an event with before and after audit snapshots", async () => {
    const sql = requireDatabase();
    const { eventId, eventName } = await createFixtureEvent();
    const nextName = `${eventName} updated`;

    const result = await updateReservationEvent({
      eventId,
      values: eventValues({
        name: nextName,
        description: "After description",
        location: "After location",
        startsAt: null,
        status: "open",
        reservationsOpenAt: new Date("2026-10-04T12:00:00.000Z"),
        reservationsCloseAt: new Date("2026-10-04T16:00:00.000Z"),
      }),
    });

    expect(result).toEqual({ ok: true, message: "Event updated." });
    const [event] = await sql<
      {
        name: string;
        description: string;
        location: string;
        status: string;
        starts_at: Date | null;
      }[]
    >`
      SELECT name, description, location, status::text, starts_at
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    expect(event).toEqual({
      name: nextName,
      description: "After description",
      location: "After location",
      status: "open",
      starts_at: null,
    });
    const [audit] = await sql<
      {
        event_name: string;
        action: string;
        details: {
          before: Record<string, unknown>;
          after: Record<string, unknown>;
        };
      }[]
    >`
      SELECT event_name, action, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
        AND action = 'event.updated'
    `;
    expect(audit).toMatchObject({
      event_name: nextName,
      action: "event.updated",
      details: {
        before: {
          id: eventId,
          name: eventName,
          description: "Before description",
          location: "Before location",
          status: "draft",
        },
        after: {
          id: eventId,
          name: nextName,
          description: "After description",
          location: "After location",
          status: "open",
        },
      },
    });
  });

  test("archives an event and writes event.archived", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent({ status: "open" });

    const result = await archiveReservationEvent(eventId);

    expect(result).toEqual({ ok: true, message: "Event archived." });
    const [event] = await sql<{ status: string }[]>`
      SELECT status::text
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    expect(event.status).toBe("archived");
    const [audit] = await sql<
      {
        action: string;
        details: {
          before: { status: string };
          after: { status: string };
        };
      }[]
    >`
      SELECT action, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
        AND action = 'event.archived'
    `;
    expect(audit).toMatchObject({
      action: "event.archived",
      details: {
        before: { status: "open" },
        after: { status: "archived" },
      },
    });
  });

  test("restores an archived event only to closed and writes event.restored", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent({ status: "archived" });

    const result = await restoreReservationEvent(eventId);

    expect(result).toEqual({
      ok: true,
      message: "Event restored to closed.",
    });
    const [event] = await sql<{ status: string }[]>`
      SELECT status::text
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    expect(event.status).toBe("closed");
    const [audit] = await sql<
      {
        action: string;
        details: {
          before: { status: string };
          after: { status: string };
        };
      }[]
    >`
      SELECT action, details
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
        AND action = 'event.restored'
    `;
    expect(audit).toMatchObject({
      action: "event.restored",
      details: {
        before: { status: "archived" },
        after: { status: "closed" },
      },
    });
  });

  test("rejects normal edits to archived events without audit", async () => {
    const sql = requireDatabase();
    const { eventId, eventName } = await createFixtureEvent({
      status: "archived",
    });

    const result = await updateReservationEvent({
      eventId,
      values: eventValues({ name: "Forbidden archived edit" }),
    });

    expect(result).toEqual({
      ok: false,
      error: "Archived events are read-only. Restore the event before editing.",
    });
    const [event] = await sql<{ name: string; status: string }[]>`
      SELECT name, status::text
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    expect(event).toEqual({ name: eventName, status: "archived" });
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_id = ${eventId}::uuid
    `;
    expect(auditCount.count).toBe(0);
  });

  test("blocks event deletion with sorted occupied table numbers", async () => {
    const sql = requireDatabase();
    const { eventId } = await createFixtureEvent();
    await addFixtureTable({ eventId, number: 10, teamId: assignedTeamId });
    await addFixtureTable({ eventId, number: 7 });
    await addFixtureTable({
      eventId,
      number: 2,
      teamId: secondAssignedTeamId,
    });

    const result = await deleteReservationEvent(eventId);

    expect(result).toEqual({
      ok: false,
      error:
        "Unassign teams from occupied tables 2 and 10 before deleting this event.",
    });
    const [eventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
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
    expect(eventCount.count).toBe(1);
    expect(tableCount.count).toBe(3);
    expect(auditCount.count).toBe(0);
  });

  test("deletion observes an assignment that commits while table locking", async () => {
    const sql = requireDatabase();
    const assignmentSql = requireLockDatabase();
    const { eventId } = await createFixtureEvent();
    const tableId = await addFixtureTable({ eventId, number: 1 });
    let deletionPromise!: ReturnType<typeof deleteReservationEvent>;
    let deletionSettled = false;
    let deletionWasBlocked = false;

    await assignmentSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        UPDATE public.tables
        SET
          reserved_by_team_id = ${assignedTeamId}::uuid,
          reserved_at = now()
        WHERE id = ${tableId}::uuid
      `;

      deletionPromise = deleteReservationEvent(eventId);
      void deletionPromise.then(
        () => {
          deletionSettled = true;
        },
        () => {
          deletionSettled = true;
        },
      );
      deletionWasBlocked = await waitUntilBlockedBy(
        holder.pid,
        () => deletionSettled,
      );
    });

    const result = await deletionPromise;

    expect(deletionWasBlocked).toBe(true);
    expect(result).toEqual({
      ok: false,
      error:
        "Unassign the team from occupied table 1 before deleting this event.",
    });
    const [event] = await sql<{ id: string }[]>`
      SELECT id::text
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    const [table] = await sql<
      { reserved_by_team_id: string; reserved_at: Date }[]
    >`
      SELECT reserved_by_team_id::text, reserved_at
      FROM public.tables
      WHERE id = ${tableId}::uuid
    `;
    const [deletedAudit] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE action = 'event.deleted'
        AND entity_id = ${eventId}::uuid
    `;
    expect(event.id).toBe(eventId);
    expect(table.reserved_by_team_id).toBe(assignedTeamId);
    expect(table.reserved_at).toBeInstanceOf(Date);
    expect(deletedAudit.count).toBe(0);
  });

  test("deletes an unassigned event, cascades tables, and retains its audit snapshot", async () => {
    const sql = requireDatabase();
    const { eventId, eventName } = await createFixtureEvent({
      status: "closed",
    });
    await addFixtureTable({ eventId, number: 1 });
    await addFixtureTable({ eventId, number: 2 });

    const result = await deleteReservationEvent(eventId);

    expect(result).toEqual({ ok: true, message: "Event deleted." });
    const [eventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.events
      WHERE id = ${eventId}::uuid
    `;
    const [tableCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.tables
      WHERE event_id = ${eventId}::uuid
    `;
    expect(eventCount.count).toBe(0);
    expect(tableCount.count).toBe(0);
    const [audit] = await sql<
      {
        event_id: string | null;
        event_name: string;
        actor_user_id: string;
        actor_email: string;
        action: string;
        entity_id: string;
        details: { before: Record<string, unknown> };
      }[]
    >`
      SELECT
        event_id::text,
        event_name,
        actor_user_id::text,
        actor_email,
        action,
        entity_id::text,
        details
      FROM public.reservation_audit_log
      WHERE action = 'event.deleted'
        AND entity_id = ${eventId}::uuid
    `;
    expect(audit).toMatchObject({
      event_id: null,
      event_name: eventName,
      actor_user_id: organizer.id,
      actor_email: organizer.email,
      action: "event.deleted",
      entity_id: eventId,
      details: {
        before: {
          id: eventId,
          name: eventName,
          status: "closed",
        },
      },
    });
  });

  test("rolls back event creation when the real audit insert fails", async () => {
    const sql = requireDatabase();
    const name = `Rolled back event ${randomUUID()}`;
    requireOrganizerMock.mockResolvedValue({
      ...organizer,
      id: randomUUID(),
    });

    const result = await createReservationEvent(eventValues({ name }));

    expect(result).toEqual({
      ok: false,
      error: "A related record no longer exists. Refresh and try again.",
    });
    const [eventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.events
      WHERE name = ${name}
    `;
    const [auditCount] = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.reservation_audit_log
      WHERE event_name = ${name}
    `;
    expect(eventCount.count).toBe(0);
    expect(auditCount.count).toBe(0);
  });

  test("organizer updates wait for participant event share locks", async () => {
    const lockSql = requireLockDatabase();
    const { eventId, eventName } = await createFixtureEvent({
      status: "open",
    });
    let actionPromise!: ReturnType<typeof updateReservationEvent>;
    let actionSettled = false;
    let actionWasBlocked = false;

    await lockSql.begin(async (transaction) => {
      const [holder] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid() AS pid
      `;
      await transaction`
        SELECT id
        FROM public.events
        WHERE id = ${eventId}::uuid
        FOR SHARE
      `;
      actionPromise = updateReservationEvent({
        eventId,
        values: eventValues({
          name: `${eventName} serialized`,
          status: "closed",
        }),
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
    expect(result).toEqual({ ok: true, message: "Event updated." });
  });

  test("revalidates participant and organizer event paths after mutation", async () => {
    const { eventId } = await createFixtureEvent();

    const result = await archiveReservationEvent(eventId);

    expect(result.ok).toBe(true);
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/reserve",
        "/admin/reservations",
        "/admin/reservations/audit",
        `/admin/reservations/${eventId}`,
        `/admin/reservations/${eventId}/tables`,
        `/admin/reservations/${eventId}/assignments`,
        `/admin/reservations/${eventId}/audit`,
        `/admin/reservations/${eventId}/preview`,
      ]),
    );
  });
});
