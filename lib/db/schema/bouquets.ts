import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import type { SharedArrangement } from "@/lib/bouquet/share";
import { isOrganizer } from "./rls";
import { users } from "./users";

/*
  Bouquets hackers chose to share from the bouquet game, shown in the /live
  hero. The arrangement is stored, not a rendered PNG: every pixel then comes
  from our own catalog art, so there is no uploaded image to vet, and /live
  redraws it with the same renderSticker the game exports with.

  One row per user — sharing again replaces it — so a random pick stays fair
  and nobody can flood the strip. `hidden` is the organizer's off switch,
  flipped in the Supabase Table Editor; re-sharing never clears it.
*/
export const liveBouquets = pgTable(
  "live_bouquets",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    arrangement: jsonb().$type<SharedArrangement>().notNull(),
    makerName: text("maker_name").notNull(),
    hidden: boolean().default(false).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("live_bouquets_user_id_unique").on(table.userId),
    index("live_bouquets_hidden_idx").on(table.hidden),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "live_bouquets_user_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("live_bouquets_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type LiveBouquetRow = typeof liveBouquets.$inferSelect;
