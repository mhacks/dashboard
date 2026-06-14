#!/usr/bin/env node
// Seed the local database with sample judging events, tables, teams, and a
// single dev user for testing reservations without auth.
//
//   pnpm db:seed

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, tables, teams, users } from "../lib/db/schema.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Start the stack (`pnpm db:local`) and run `pnpm db:env`.",
  );
  process.exit(1);
}

const TABLES_PER_EVENT = 40;

const sampleEvents = [
  {
    name: "MHacks 2026 — Final Judging",
    description: "Top projects present to the judging panel.",
    location: "Placeholder Hall — Room A",
    startsAt: new Date("2026-10-04T13:00:00Z"),
  },
  {
    name: "MHacks 2026 — Track Demos",
    description: "Open demos for AI, Sustainability, Healthcare, and Fintech.",
    location: "Placeholder Hall — Room B",
    startsAt: new Date("2026-10-04T16:00:00Z"),
  },
];

// Other teams with pre-reserved tables so the map shows mixed availability.
const otherTeams = ["Team A", "Team B", "Team C"];

const TEST_TEAM_NAME = "Team Test";

const client = postgres(connectionString, { prepare: false });
const db = drizzle({ client });

async function main() {
  console.log("Seeding reservation data…");

  await db.delete(tables);
  await db.delete(events);
  await db.delete(users);
  await db.delete(teams);

  const [team] = await db
    .insert(teams)
    .values({ name: TEST_TEAM_NAME })
    .returning({ id: teams.id });

  await db.insert(users).values({
    id: "00000000-0000-4000-8000-000000000001", // TEMP_SIGNED_IN_USER in queries/reservation.ts
    email: "test@local",
    teamId: team.id,
  });
  console.log(`  + Test User → team "${TEST_TEAM_NAME}"`);

  const insertedOtherTeams = await db
    .insert(teams)
    .values(otherTeams.map((name) => ({ name })))
    .returning({ id: teams.id, name: teams.name });

  const insertedEvents = await db
    .insert(events)
    .values(sampleEvents)
    .returning({ id: events.id, name: events.name });

  for (const event of insertedEvents) {
    const rows = Array.from({ length: TABLES_PER_EVENT }, (_, i) => ({
      eventId: event.id,
      number: i + 1,
    }));
    await db.insert(tables).values(rows);
    console.log(`  + ${TABLES_PER_EVENT} tables for "${event.name}"`);

    // Pre-reserve a few tables for other teams so the map isn't all open.
    for (let i = 0; i < insertedOtherTeams.length; i++) {
      await db
        .update(tables)
        .set({
          reservedByTeamId: insertedOtherTeams[i].id,
          reservedAt: new Date(),
        })
        .where(and(eq(tables.eventId, event.id), eq(tables.number, i + 1)));
    }
  }

  console.log(`  + ${insertedOtherTeams.length} other teams (sample reserved)`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
