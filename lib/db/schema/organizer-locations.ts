import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";

/*
  Find my organizer: organizers who opted in to share their phone's location
  through the OwnTracks app, which POSTs to /api/owntracks.

  A sharing row exists only while someone is sharing. Stopping deletes it,
  which cascades to every point they sent and revokes their OwnTracks
  password, so opting out leaves nothing behind.

  Only a SHA-256 of the OwnTracks password is stored. It is 32 random bytes,
  so a fast hash is enough; the plaintext is shown once, in the setup link.
*/
export const organizerLocationSharing = pgTable(
  "organizer_location_sharing",
  {
    userId: uuid("user_id").primaryKey().notNull(),
    /** What hackers see on the map, chosen by the organizer. */
    displayName: text("display_name").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organizer_location_sharing_token_hash_unique").on(table.tokenHash),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "organizer_location_sharing_user_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("organizer_location_sharing_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

/*
  One row per fix. The ingest route trims each organizer's history to a short
  trail as it inserts, always keeping their newest point. `recorded_at` is the
  phone's fix time (OwnTracks `tst`); the app can deliver queued fixes late,
  so it is not the same as `received_at`.
*/
export const organizerLocations = pgTable(
  "organizer_locations",
  {
    userId: uuid("user_id").notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    /** Radius in meters, when the phone reports one. */
    accuracy: integer(),
    /** Percent, when the phone reports it. */
    battery: smallint(),
    recordedAt: timestamp("recorded_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "organizer_locations_pkey",
      columns: [table.userId, table.recordedAt],
    }),
    index("organizer_locations_recorded_at_idx").on(table.recordedAt),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [organizerLocationSharing.userId],
      name: "organizer_locations_user_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("organizer_locations_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export type OrganizerLocationSharingRow =
  typeof organizerLocationSharing.$inferSelect;
export type OrganizerLocationRow = typeof organizerLocations.$inferSelect;
