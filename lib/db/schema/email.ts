import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";
import type {
  EmailCampaignContent,
  EmailTemplateType,
  EmailThemeTokens,
} from "@/lib/email/types";

export const emailTemplateType = pgEnum("email_template_type", [
  "structured",
  "html",
]);

export const emailCampaignStatus = pgEnum("email_campaign_status", [
  "draft",
  "ready",
  "sending",
  "sent",
  "failed",
  "cancelled",
]);

export const emailRecipientStatus = pgEnum("email_recipient_status", [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
]);

export type EmailTemplateSnapshot = {
  name: string;
  type: EmailTemplateType;
  subject: string;
  previewText: string;
  content: EmailCampaignContent | null;
  html: string | null;
  sourceTemplateId: string;
};

export type EmailCampaignEventDetails = Record<string, unknown>;
export type EmailRecipientMergeData = Record<string, string>;

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    type: emailTemplateType().notNull(),
    description: text().default("").notNull(),
    subject: text().notNull(),
    previewText: text("preview_text").default("").notNull(),
    content: jsonb().$type<EmailCampaignContent | null>(),
    html: text(),
    themeSnapshot: jsonb("theme_snapshot").$type<EmailThemeTokens | null>(),
    status: text().default("active").notNull(),
    sourceTemplateId: text("source_template_id")
      .default("mhacks-announcement")
      .notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    updatedByUserId: uuid("updated_by_user_id").notNull(),
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
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "email_templates_created_by_user_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "email_templates_updated_by_user_id_fkey",
    }).onDelete("restrict"),
    index("email_templates_updated_at_idx").on(table.updatedAt),
    pgPolicy("email_templates_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_templates_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_templates_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_templates_organizer_delete", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export const emailThemeSettings = pgTable(
  "email_theme_settings",
  {
    key: text().primaryKey().notNull(),
    theme: jsonb().$type<EmailThemeTokens>().notNull(),
    updatedByUserId: uuid("updated_by_user_id").notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "email_theme_settings_updated_by_user_id_fkey",
    }).onDelete("restrict"),
    pgPolicy("email_theme_settings_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_theme_settings_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_theme_settings_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    templateId: uuid("template_id"),
    templateSnapshot: jsonb("template_snapshot")
      .$type<EmailTemplateSnapshot>()
      .notNull(),
    themeSnapshot: jsonb("theme_snapshot").$type<EmailThemeTokens | null>(),
    status: emailCampaignStatus().default("draft").notNull(),
    subject: text().notNull(),
    previewText: text("preview_text").default("").notNull(),
    totalRecipients: integer("total_recipients").default(0).notNull(),
    sentCount: integer("sent_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    isDirectSend: boolean("is_direct_send").default(false).notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    updatedByUserId: uuid("updated_by_user_id").notNull(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
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
      columns: [table.templateId],
      foreignColumns: [emailTemplates.id],
      name: "email_campaigns_template_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "email_campaigns_created_by_user_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "email_campaigns_updated_by_user_id_fkey",
    }).onDelete("restrict"),
    index("email_campaigns_created_at_idx").on(table.createdAt),
    pgPolicy("email_campaigns_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_campaigns_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_campaigns_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_campaigns_organizer_delete", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    campaignId: uuid("campaign_id").notNull(),
    email: text().notNull(),
    mergeData: jsonb("merge_data").$type<EmailRecipientMergeData>().notNull(),
    status: emailRecipientStatus().default("pending").notNull(),
    messageId: text("message_id"),
    error: text(),
    sentAt: timestamp("sent_at", {
      withTimezone: true,
      mode: "string",
    }),
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
      columns: [table.campaignId],
      foreignColumns: [emailCampaigns.id],
      name: "email_campaign_recipients_campaign_id_fkey",
    }).onDelete("cascade"),
    unique("email_campaign_recipients_campaign_email_unique").on(
      table.campaignId,
      table.email,
    ),
    index("email_campaign_recipients_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    pgPolicy("email_campaign_recipients_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_campaign_recipients_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_campaign_recipients_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_campaign_recipients_organizer_delete", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export const emailCampaignEvents = pgTable(
  "email_campaign_events",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    campaignId: uuid("campaign_id"),
    actorUserId: uuid("actor_user_id").notNull(),
    eventType: text("event_type").notNull(),
    details: jsonb().$type<EmailCampaignEventDetails>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [emailCampaigns.id],
      name: "email_campaign_events_campaign_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.actorUserId],
      foreignColumns: [users.id],
      name: "email_campaign_events_actor_user_id_fkey",
    }).onDelete("restrict"),
    index("email_campaign_events_campaign_created_at_idx").on(
      table.campaignId,
      table.createdAt,
    ),
    pgPolicy("email_campaign_events_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_campaign_events_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type EmailThemeSettingRow = typeof emailThemeSettings.$inferSelect;
export type EmailCampaignRow = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;
export type EmailCampaignRecipientRow =
  typeof emailCampaignRecipients.$inferSelect;
export type NewEmailCampaignRecipient =
  typeof emailCampaignRecipients.$inferInsert;
export type EmailCampaignEventRow = typeof emailCampaignEvents.$inferSelect;
export type NewEmailCampaignEvent = typeof emailCampaignEvents.$inferInsert;
