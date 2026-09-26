import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole } from "drizzle-orm/supabase";
import { events } from "./events";
import { isOrganizer } from "./rls";
import { users } from "./users";

const publicRoles = [anonRole, authenticatedRole];

export const liveContentStatus = pgEnum("live_content_status", [
  "draft",
  "published",
  "archived",
]);

export const liveAnnouncementTone = pgEnum("live_announcement_tone", [
  "info",
  "important",
  "urgent",
]);

export const liveEventResourceKind = pgEnum("live_event_resource_kind", [
  "devpost",
  "workshop",
  "slides",
  "registration",
  "resource",
]);

export const liveSiteSettings = pgTable(
  "live_site_settings",
  {
    id: text().primaryKey().default("default").notNull(),
    eventName: text("event_name").default("MHacks Live").notNull(),
    heroTitle: text("hero_title").default("Timeline").notNull(),
    heroDescription: text("hero_description")
      .default("Events, workshops, food, and deadlines for the weekend.")
      .notNull(),
    timezone: text().default("America/Detroit").notNull(),
    devpostUrl: text("devpost_url"),
    guideEmptyTitle: text("guide_empty_title")
      .default("Hacker guide coming soon")
      .notNull(),
    guideEmptyDescription: text("guide_empty_description")
      .default(
        "Travel details, venue information, policies, and weekend resources are being assembled here.",
      )
      .notNull(),
    prizesEmptyTitle: text("prizes_empty_title")
      .default("Prize details coming soon")
      .notNull(),
    prizesEmptyDescription: text("prizes_empty_description")
      .default(
        "Track descriptions, eligibility details, and judging criteria will appear here once they are finalized.",
      )
      .notNull(),
    updatedByUserId: uuid("updated_by_user_id"),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("live_site_settings_singleton_check", sql`${table.id} = 'default'`),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "live_site_settings_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("live_site_settings_public_select", {
      for: "select",
      to: publicRoles,
      using: sql`true`,
    }),
    pgPolicy("live_site_settings_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const liveEventDetails = pgTable(
  "live_event_details",
  {
    eventId: uuid("event_id").primaryKey().notNull(),
    description: text().default("").notNull(),
    locationDetails: text("location_details").default("").notNull(),
    mapUrl: text("map_url"),
    eventType: text("event_type").default("Event").notNull(),
    hostName: text("host_name"),
    audience: text(),
    capacity: integer(),
    featured: boolean().default(false).notNull(),
    status: liveContentStatus().default("draft").notNull(),
    position: integer().default(0).notNull(),
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
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
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "live_event_details_event_id_fkey",
    }).onDelete("cascade"),
    index("live_event_details_public_order_idx").on(
      table.status,
      table.position,
    ),
    check(
      "live_event_details_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    check(
      "live_event_details_capacity_positive_check",
      sql`${table.capacity} is null or ${table.capacity} > 0`,
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "live_event_details_created_by_user_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "live_event_details_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("live_event_details_public_select", {
      for: "select",
      to: publicRoles,
      using: sql`${table.status} = 'published'`,
    }),
    pgPolicy("live_event_details_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const liveEventResources = pgTable(
  "live_event_resources",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    eventId: uuid("event_id").notNull(),
    kind: liveEventResourceKind().default("resource").notNull(),
    label: text().notNull(),
    url: text(),
    position: integer().default(0).notNull(),
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
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "live_event_resources_event_id_fkey",
    }).onDelete("cascade"),
    index("live_event_resources_event_position_idx").on(
      table.eventId,
      table.position,
    ),
    check(
      "live_event_resources_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    pgPolicy("live_event_resources_public_select", {
      for: "select",
      to: publicRoles,
      using: sql`exists (
        select 1 from public.live_event_details
        where live_event_details.event_id = ${table.eventId}
          and live_event_details.status = 'published'
      )`,
    }),
    pgPolicy("live_event_resources_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const liveAnnouncements = pgTable(
  "live_announcements",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    tone: liveAnnouncementTone().default("info").notNull(),
    status: liveContentStatus().default("draft").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    position: integer().default(0).notNull(),
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
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
    index("live_announcements_public_feed_idx").on(
      table.status,
      table.publishedAt,
      table.position,
    ),
    check(
      "live_announcements_expiry_after_publish_check",
      sql`${table.expiresAt} is null or ${table.publishedAt} is null or ${table.expiresAt} > ${table.publishedAt}`,
    ),
    check(
      "live_announcements_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "live_announcements_created_by_user_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "live_announcements_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("live_announcements_public_select", {
      for: "select",
      to: publicRoles,
      using: sql`${table.status} = 'published'
        and (${table.publishedAt} is null or ${table.publishedAt} <= now())
        and (${table.expiresAt} is null or ${table.expiresAt} > now())`,
    }),
    pgPolicy("live_announcements_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const liveGuideLinks = pgTable(
  "live_guide_links",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    description: text().default("").notNull(),
    url: text().notNull(),
    category: text().default("General").notNull(),
    status: liveContentStatus().default("draft").notNull(),
    position: integer().default(0).notNull(),
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
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
    index("live_guide_links_public_order_idx").on(table.status, table.position),
    check(
      "live_guide_links_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "live_guide_links_created_by_user_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "live_guide_links_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("live_guide_links_public_select", {
      for: "select",
      to: publicRoles,
      using: sql`${table.status} = 'published'`,
    }),
    pgPolicy("live_guide_links_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const livePrizes = pgTable(
  "live_prizes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    description: text().default("").notNull(),
    sponsor: text(),
    value: text(),
    eligibility: text().default("").notNull(),
    judgingCriteria: text("judging_criteria").default("").notNull(),
    url: text(),
    status: liveContentStatus().default("draft").notNull(),
    position: integer().default(0).notNull(),
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
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
    index("live_prizes_public_order_idx").on(table.status, table.position),
    check(
      "live_prizes_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "live_prizes_created_by_user_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "live_prizes_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("live_prizes_public_select", {
      for: "select",
      to: publicRoles,
      using: sql`${table.status} = 'published'`,
    }),
    pgPolicy("live_prizes_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type LiveSiteSettingsRow = typeof liveSiteSettings.$inferSelect;
export type LiveEventDetailsRow = typeof liveEventDetails.$inferSelect;
export type LiveEventResourceRow = typeof liveEventResources.$inferSelect;
export type LiveAnnouncementRow = typeof liveAnnouncements.$inferSelect;
export type LiveGuideLinkRow = typeof liveGuideLinks.$inferSelect;
export type LivePrizeRow = typeof livePrizes.$inferSelect;
