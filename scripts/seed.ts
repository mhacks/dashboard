#!/usr/bin/env node
// Seed the local database with sample judging events, tables, teams, and a
// single admin user for testing reservations without auth.
//
//   pnpm db:seed

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, tables, teams } from "../lib/db/schema/reservation.ts";
import { users } from "../lib/db/schema/users.ts";

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

const sampleTeams = ["Team A", "Team B", "Team C"];

const client = postgres(connectionString, { prepare: false });
const db = drizzle({ client });

async function main() {
  console.log("Seeding reservation data…");

  await db.delete(tables);
  await db.delete(events);
  await db.delete(teams);

  await db
    .insert(users)
    .values({
      id: "00000000-0000-4000-8000-000000000001", // TEMP_SIGNED_IN_USER in queries/reservation.ts
      email: "test@local",
      isAdmin: true,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: "test@local", isAdmin: true, teamId: null },
    });
  console.log("  + Test User (admin, no team)");

  const insertedTeams = await db
    .insert(teams)
    .values(sampleTeams.map((name) => ({ name })))
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

    for (let i = 0; i < insertedTeams.length; i++) {
      await db
        .update(tables)
        .set({
          reservedByTeamId: insertedTeams[i].id,
          reservedAt: new Date(),
        })
        .where(and(eq(tables.eventId, event.id), eq(tables.number, i + 1)));
    }
  }

  console.log(`  + ${insertedTeams.length} teams (sample reserved)`);
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
