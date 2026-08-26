import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const fixture = {
  eventId: "40000000-0000-4000-8000-000000000000",
  tables: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      number: 9001,
      teamId: "40000000-0000-4000-8000-000000000002",
    },
    {
      id: "40000000-0000-4000-8000-000000000003",
      number: 0,
      teamId: "40000000-0000-4000-8000-000000000004",
    },
    {
      id: "40000000-0000-4000-8000-000000000005",
      number: -7,
      teamId: "40000000-0000-4000-8000-000000000006",
    },
  ],
  marker: "reservation-management-upgrade-fixture-v1",
};

const database = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await database.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.events (
        id,
        name,
        description,
        starts_at,
        location
      )
      VALUES (
        ${fixture.eventId}::uuid,
        'Reservation upgrade fixture',
        'Legacy event used to verify assignment preservation.',
        '2026-10-04T12:00:00Z'::timestamptz,
        'Upgrade test'
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        starts_at = EXCLUDED.starts_at,
        location = EXCLUDED.location
    `;

    for (const table of fixture.tables) {
      await transaction`
        INSERT INTO public.tables (
          id,
          event_id,
          number,
          reserved_by_team_id,
          reserved_at
        )
        VALUES (
          ${table.id}::uuid,
          ${fixture.eventId}::uuid,
          ${table.number},
          ${table.teamId}::uuid,
          NULL
        )
        ON CONFLICT (id) DO UPDATE SET
          event_id = EXCLUDED.event_id,
          number = EXCLUDED.number,
          reserved_by_team_id = EXCLUDED.reserved_by_team_id,
          reserved_at = NULL
      `;
    }

    await transaction`
      CREATE TABLE IF NOT EXISTS public.reservation_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        event_id uuid,
        event_name text NOT NULL,
        actor_user_id uuid,
        actor_email text NOT NULL,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid,
        details jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    await transaction`
      CREATE TABLE IF NOT EXISTS public.reservation_upgrade_test_markers (
        marker text PRIMARY KEY,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `;
    await transaction`
      INSERT INTO public.reservation_upgrade_test_markers (marker)
      VALUES (${fixture.marker})
      ON CONFLICT (marker) DO NOTHING
    `;
  });

  console.log(
    `Inserted ${fixture.tables.length} legacy reservation fixtures with assigned positive, zero, and negative table numbers.`,
  );
} finally {
  await database.end({ timeout: 5 });
}
