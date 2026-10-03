import {
  doublePrecision,
  index,
  integer,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";

/*
  Find my organizer: each person's latest fix, upserted by /api/owntracks
  whenever their OwnTracks app POSTs. A person is whatever username they typed
  into the app, which is also the name shown on the map; the route checks the
  shared password.

  The route deletes rows older than the organizer window as it writes, so
  someone who turns the app off drops off the map within a few hours.
  `recorded_at` is the phone's fix time (OwnTracks `tst`); the app can deliver
  queued fixes late, so it is not the same as `received_at`.
*/
export const organizerLocations = pgTable(
  "organizer_locations",
  {
    /** The OwnTracks username, shown on the map as typed. */
    name: text().primaryKey().notNull(),
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
    index("organizer_locations_recorded_at_idx").on(table.recordedAt),
    pgPolicy("organizer_locations_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export type OrganizerLocationRow = typeof organizerLocations.$inferSelect;
