import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const liveEvents = pgTable("live_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  location: text("location").notNull(),
  description: text("description").notNull(),
  eventType: text("event_type").notNull().default("event"),
  mapUrl: text("map_url"),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LiveEventRow = typeof liveEvents.$inferSelect;
export type NewLiveEvent = typeof liveEvents.$inferInsert;
