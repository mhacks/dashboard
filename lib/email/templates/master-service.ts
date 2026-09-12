import { desc, eq } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  emailHiddenSeedTemplates,
  emailTemplates,
  emailThemeSettings,
  type EmailTemplateRow,
} from "@/lib/db/schema/email";
import { EmailCampaignError } from "@/lib/email/campaigns/config";
import { defaultEmailTheme, normalizeEmailTheme } from "@/lib/email/theme";
import {
  getEmailTemplate,
  getTemplateCatalog,
} from "@/lib/email/templates/registry";
import {
  emailTemplateUpsertSchema,
  emailThemeTokensSchema,
  type EmailCampaignContent,
  type EmailTemplateType,
} from "@/lib/email/types";

const activeThemeKey = "active";

export interface MasterTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  description: string;
  subject: string;
  previewText: string;
  content: EmailCampaignContent | null;
  html: string | null;
  status: string;
  updatedAt: string;
  sourceTemplateId: string;
}

export async function listMasterTemplates() {
  await requireOrganizer();

  const [rows, hiddenSeeds] = await Promise.all([
    db.select().from(emailTemplates).orderBy(desc(emailTemplates.updatedAt)),
    db
      .select({ sourceTemplateId: emailHiddenSeedTemplates.sourceTemplateId })
      .from(emailHiddenSeedTemplates),
  ]);

  const savedTemplates = rows.map(templateFromRow);
  const hiddenSourceIds = new Set(
    hiddenSeeds.map((row) => row.sourceTemplateId),
  );
  const usedSourceIds = new Set(
    savedTemplates.map((template) => template.sourceTemplateId),
  );

  return {
    templates: [
      ...savedTemplates,
      ...getSeedMasterTemplates().filter(
        (template) =>
          !hiddenSourceIds.has(template.sourceTemplateId) &&
          !usedSourceIds.has(template.sourceTemplateId),
      ),
    ],
    databaseReady: true,
  };
}

export async function createMasterTemplate(input: unknown) {
  const organizer = await requireOrganizer();
  const payload = validateTemplatePayload(input);
  const now = new Date().toISOString();

  const [template] = await db
    .insert(emailTemplates)
    .values({
      name: payload.name,
      type: payload.type,
      description: payload.description,
      subject: payload.subject,
      previewText: payload.previewText,
      content: payload.content ?? null,
      html: payload.html ?? null,
      status: payload.status,
      sourceTemplateId: payload.sourceTemplateId,
      createdByUserId: organizer.id,
      updatedByUserId: organizer.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return templateFromRow(template);
}

export async function updateMasterTemplate(templateId: string, input: unknown) {
  const organizer = await requireOrganizer();
  const payload = validateTemplatePayload(input);
  const now = new Date().toISOString();

  const [template] = await db
    .update(emailTemplates)
    .set({
      name: payload.name,
      type: payload.type,
      description: payload.description,
      subject: payload.subject,
      previewText: payload.previewText,
      content: payload.content ?? null,
      html: payload.html ?? null,
      status: payload.status,
      sourceTemplateId: payload.sourceTemplateId,
      updatedByUserId: organizer.id,
      updatedAt: now,
    })
    .where(eq(emailTemplates.id, templateId))
    .returning();

  if (!template) {
    throw new EmailCampaignError("Email template not found", 404);
  }

  return templateFromRow(template);
}

export async function deleteMasterTemplate(templateId: string) {
  const organizer = await requireOrganizer();

  if (templateId.startsWith("local-")) {
    return;
  }

  if (templateId.startsWith("seed-")) {
    await hideSeedTemplate(templateId.slice("seed-".length), organizer.id);
    return;
  }

  const [deleted] = await db
    .delete(emailTemplates)
    .where(eq(emailTemplates.id, templateId))
    .returning();

  if (!deleted) {
    throw new EmailCampaignError("Email template not found", 404);
  }

  await hideSeedTemplate(deleted.sourceTemplateId, organizer.id);
}

async function hideSeedTemplate(sourceTemplateId: string, organizerId: string) {
  if (!sourceTemplateId) {
    return;
  }

  await db
    .insert(emailHiddenSeedTemplates)
    .values({
      sourceTemplateId,
      hiddenByUserId: organizerId,
    })
    .onConflictDoNothing();
}

export async function getActiveTheme() {
  await requireOrganizer();

  const [setting] = await db
    .select()
    .from(emailThemeSettings)
    .where(eq(emailThemeSettings.key, activeThemeKey))
    .limit(1);

  return {
    theme: normalizeEmailTheme(setting?.theme ?? defaultEmailTheme),
    databaseReady: true,
  };
}

export async function saveActiveTheme(input: unknown) {
  const organizer = await requireOrganizer();
  const theme = normalizeEmailTheme(emailThemeTokensSchema.parse(input));
  const now = new Date().toISOString();

  const [setting] = await db
    .insert(emailThemeSettings)
    .values({
      key: activeThemeKey,
      theme,
      updatedByUserId: organizer.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: emailThemeSettings.key,
      set: {
        theme,
        updatedByUserId: organizer.id,
        updatedAt: now,
      },
    })
    .returning();

  return normalizeEmailTheme(setting.theme);
}

export function getSeedMasterTemplates(): MasterTemplate[] {
  return getTemplateCatalog().map((template) => ({
    id: `seed-${template.id}`,
    name: template.name,
    type: "structured",
    description: template.description,
    subject: template.defaultSubject,
    previewText: template.defaultPreviewText,
    content: template.defaultContent,
    html: null,
    status: "active",
    updatedAt: new Date(0).toISOString(),
    sourceTemplateId: template.id,
  }));
}

function validateTemplatePayload(input: unknown) {
  const payload = emailTemplateUpsertSchema.parse(input);

  if (payload.type === "structured") {
    if (!payload.content) {
      throw new EmailCampaignError("Structured templates require content", 400);
    }

    if (!getEmailTemplate(payload.sourceTemplateId)) {
      throw new EmailCampaignError("Unknown email template source", 400);
    }
  }

  if (payload.type === "html" && !payload.html) {
    throw new EmailCampaignError("HTML templates require HTML", 400);
  }

  return payload;
}

function templateFromRow(row: EmailTemplateRow): MasterTemplate {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    subject: row.subject,
    previewText: row.previewText,
    content: row.content ?? null,
    html: row.html ?? null,
    status: row.status,
    updatedAt: row.updatedAt,
    sourceTemplateId: row.sourceTemplateId,
  };
}
