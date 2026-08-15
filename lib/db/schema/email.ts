import {
  integer,
  foreignKey,
  index,
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

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    type: emailTemplateType().$type<EmailTemplateType>().notNull(),
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

export const emailSendRuns = pgTable(
  "email_send_runs",
  {
    id: uuid().primaryKey().notNull(),
    organizerId: uuid("organizer_id").notNull(),
    templateFingerprint: text("template_fingerprint").notNull(),
    recipientListHash: text("recipient_list_hash").notNull(),
    totalRecipients: integer("total_recipients").notNull(),
    status: text().default("sending").notNull(),
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
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizerId],
      foreignColumns: [users.id],
      name: "email_send_runs_organizer_id_fkey",
    }).onDelete("restrict"),
    index("email_send_runs_organizer_created_at_idx").on(
      table.organizerId,
      table.createdAt,
    ),
    pgPolicy("email_send_runs_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_send_runs_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_send_runs_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const emailSendBatches = pgTable(
  "email_send_batches",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    runId: uuid("run_id").notNull(),
    cursor: integer().notNull(),
    endCursor: integer("end_cursor").notNull(),
    status: text().default("sending").notNull(),
    sentCount: integer("sent_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    recentFailures: jsonb("recent_failures")
      .$type<Array<{ email: string; error: string | null }>>()
      .default([])
      .notNull(),
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
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.runId],
      foreignColumns: [emailSendRuns.id],
      name: "email_send_batches_run_id_fkey",
    }).onDelete("cascade"),
    unique("email_send_batches_run_cursor_unique").on(
      table.runId,
      table.cursor,
    ),
    index("email_send_batches_run_status_idx").on(table.runId, table.status),
    pgPolicy("email_send_batches_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("email_send_batches_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("email_send_batches_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type EmailThemeSettingRow = typeof emailThemeSettings.$inferSelect;
export type EmailSendRunRow = typeof emailSendRuns.$inferSelect;
export type EmailSendBatchRow = typeof emailSendBatches.$inferSelect;
