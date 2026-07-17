import { asc, desc, eq, sql } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  emailCampaignEvents,
  emailCampaignRecipients,
  emailCampaigns,
  type EmailCampaignRow,
  type EmailRecipientMergeData,
  type EmailTemplateSnapshot,
} from "@/lib/db/schema/email";
import type { UserEntry } from "@/lib/db/schema/users";
import {
  assertFullCampaignSendingAllowed,
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import {
  mergeDataForEmail,
  parseRecipientText,
} from "@/lib/email/campaigns/recipients";
import { sanitizeSesError, sendRenderedEmail } from "@/lib/email/campaigns/ses";
import { renderCampaignEmail, renderHtmlEmail } from "@/lib/email/render";
import { defaultEmailTheme } from "@/lib/email/theme";
import { getEmailTemplate } from "@/lib/email/templates/registry";
import {
  campaignUpsertSchema,
  type CampaignUpsertInput,
  type DirectEmailTemplateInput,
} from "@/lib/email/types";

type SendStatus = "sent" | "failed";

export interface SendResult {
  email: string;
  status: SendStatus;
  messageId: string | null;
  error: string | null;
}

export async function listCampaigns() {
  await requireOrganizer();

  const rows = await db
    .select()
    .from(emailCampaigns)
    .orderBy(desc(emailCampaigns.createdAt))
    .limit(100);

  return rows.map(campaignFromRow);
}

export async function createCampaign(input: CampaignUpsertInput) {
  const organizer = await requireOrganizer();
  const payload = validateCampaignInput(input);
  const now = new Date().toISOString();

  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      name: payload.name,
      templateSnapshot: snapshotFromCampaignPayload(payload),
      themeSnapshot: payload.themeSnapshot ?? null,
      status: "draft",
      subject: payload.subject,
      previewText: payload.previewText,
      createdByUserId: organizer.id,
      updatedByUserId: organizer.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await recordCampaignEvent({
    campaignId: campaign.id,
    organizer,
    eventType: "campaign_created",
    details: { name: campaign.name },
  });

  return campaignFromRow(campaign);
}

export async function getCampaign(campaignId: string) {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new EmailCampaignError("Email campaign not found", 404);
  }

  return campaign;
}

export async function getCampaignDetails(campaignId: string) {
  await requireOrganizer();
  const campaign = await getCampaign(campaignId);
  const [recipients, events] = await Promise.all([
    db
      .select()
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.campaignId, campaignId))
      .orderBy(asc(emailCampaignRecipients.createdAt)),
    db
      .select()
      .from(emailCampaignEvents)
      .where(eq(emailCampaignEvents.campaignId, campaignId))
      .orderBy(desc(emailCampaignEvents.createdAt))
      .limit(100),
  ]);

  return {
    campaign: campaignFromRow(campaign),
    recipients,
    events,
  };
}

export async function updateCampaign(
  campaignId: string,
  input: CampaignUpsertInput,
) {
  const organizer = await requireOrganizer();
  const payload = validateCampaignInput(input);
  const now = new Date().toISOString();

  const [campaign] = await db
    .update(emailCampaigns)
    .set({
      name: payload.name,
      templateSnapshot: snapshotFromCampaignPayload(payload),
      themeSnapshot: payload.themeSnapshot ?? null,
      subject: payload.subject,
      previewText: payload.previewText,
      updatedByUserId: organizer.id,
      updatedAt: now,
    })
    .where(eq(emailCampaigns.id, campaignId))
    .returning();

  if (!campaign) {
    throw new EmailCampaignError("Email campaign not found", 404);
  }

  await recordCampaignEvent({
    campaignId,
    organizer,
    eventType: "campaign_updated",
    details: { name: campaign.name },
  });

  return campaignFromRow(campaign);
}

export async function deleteCampaign(campaignId: string) {
  const organizer = await requireOrganizer();

  await db.delete(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
  await recordCampaignEvent({
    campaignId: null,
    organizer,
    eventType: "campaign_deleted",
    details: { campaignId },
  });
}

export async function saveCampaignRecipients(
  campaignId: string,
  recipientsText: string,
) {
  const organizer = await requireOrganizer();
  await getCampaign(campaignId);

  const parsed = parseRecipientText(recipientsText);
  enforceRecipientLimit(parsed.emails.length);

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx
      .delete(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.campaignId, campaignId));

    if (parsed.recipients.length > 0) {
      await tx.insert(emailCampaignRecipients).values(
        parsed.recipients.map((recipient) => ({
          campaignId,
          email: recipient.email,
          mergeData: buildMergeData(recipient.email, recipient.mergeData),
          status: "pending" as const,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    await tx
      .update(emailCampaigns)
      .set({
        totalRecipients: parsed.recipients.length,
        sentCount: 0,
        failedCount: 0,
        status: parsed.recipients.length > 0 ? "ready" : "draft",
        updatedByUserId: organizer.id,
        updatedAt: now,
      })
      .where(eq(emailCampaigns.id, campaignId));

    await tx.insert(emailCampaignEvents).values({
      campaignId,
      actorUserId: organizer.id,
      eventType: "recipients_saved",
      details: {
        totalRecipients: parsed.emails.length,
        invalidCount: parsed.invalid.length,
        duplicateCount: parsed.duplicateCount,
      },
      createdAt: now,
    });
  });

  return parsed;
}

export async function renderCampaignPreview(
  campaignId: string,
  override?: Partial<CampaignUpsertInput>,
) {
  await requireOrganizer();
  const campaign = await getCampaign(campaignId);
  const snapshot = {
    ...campaign.templateSnapshot,
    subject: override?.subject ?? campaign.subject,
    previewText: override?.previewText ?? campaign.previewText,
    content: override?.content ?? campaign.templateSnapshot.content,
  };

  return renderSnapshot(snapshot, campaign.themeSnapshot ?? defaultEmailTheme, {
    name: "Hacker",
    email: "hacker@mhacks.org",
    travel_reimbursement: "150.00",
  });
}

export async function processCampaignBatch(campaignId: string) {
  const organizer = await requireOrganizer();
  assertFullCampaignSendingAllowed();
  const campaign = await getCampaign(campaignId);
  const limits = getCampaignLimits();

  const pendingRecipients = await db
    .select()
    .from(emailCampaignRecipients)
    .where(
      sql`${emailCampaignRecipients.campaignId} = ${campaignId}
      AND ${emailCampaignRecipients.status} = 'pending'`,
    )
    .orderBy(asc(emailCampaignRecipients.createdAt))
    .limit(limits.batchSize);

  const now = new Date().toISOString();
  await db
    .update(emailCampaigns)
    .set({
      status: "sending",
      startedAt: campaign.startedAt ?? now,
      updatedByUserId: organizer.id,
      updatedAt: now,
    })
    .where(eq(emailCampaigns.id, campaignId));

  for (const recipient of pendingRecipients) {
    const result = await sendSnapshotToEmail(
      campaign,
      recipient.email,
      recipient.mergeData,
    );
    await updateRecipientResult(recipient.id, result);
    await sleep(limits.sendDelayMs);
  }

  const status = await refreshCampaignCounts(campaignId, organizer);
  await recordCampaignEvent({
    campaignId,
    organizer,
    eventType: "batch_processed",
    details: {
      attempted: pendingRecipients.length,
      sentCount: status.sentCount,
      failedCount: status.failedCount,
      pendingCount: status.pendingCount,
    },
  });

  return status;
}

export async function getCampaignStatus(campaignId: string) {
  await requireOrganizer();
  await getCampaign(campaignId);
  return campaignStatus(campaignId);
}

export async function createDirectCampaign(input: {
  template: DirectEmailTemplateInput;
  recipients: Array<{ email: string; mergeData: EmailRecipientMergeData }>;
  organizer: UserEntry;
}) {
  const now = new Date().toISOString();
  const snapshot = snapshotFromDirectTemplate(input.template);

  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      name: `Direct send: ${snapshot.subject}`,
      templateSnapshot: snapshot,
      themeSnapshot:
        input.template.type === "structured"
          ? (input.template.theme ?? defaultEmailTheme)
          : null,
      status: input.recipients.length > 0 ? "ready" : "draft",
      subject: snapshot.subject,
      previewText: snapshot.previewText,
      totalRecipients: input.recipients.length,
      isDirectSend: true,
      createdByUserId: input.organizer.id,
      updatedByUserId: input.organizer.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (input.recipients.length > 0) {
    await db.insert(emailCampaignRecipients).values(
      input.recipients.map((recipient) => ({
        campaignId: campaign.id,
        email: recipient.email,
        mergeData: recipient.mergeData,
        status: "pending" as const,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  await recordCampaignEvent({
    campaignId: campaign.id,
    organizer: input.organizer,
    eventType: "direct_campaign_created",
    details: { totalRecipients: input.recipients.length },
  });

  return campaign;
}

export async function recordCampaignEvent({
  campaignId,
  organizer,
  eventType,
  details,
}: {
  campaignId: string | null;
  organizer: Pick<UserEntry, "id">;
  eventType: string;
  details: Record<string, unknown>;
}) {
  await db.insert(emailCampaignEvents).values({
    campaignId,
    actorUserId: organizer.id,
    eventType,
    details,
  });
}

export function snapshotFromDirectTemplate(
  template: DirectEmailTemplateInput,
): EmailTemplateSnapshot {
  return template.type === "html"
    ? {
        name: template.subject,
        type: "html",
        subject: template.subject,
        previewText: template.previewText,
        content: null,
        html: template.html,
        sourceTemplateId: "mhacks-announcement",
      }
    : {
        name: template.subject,
        type: "structured",
        subject: template.subject,
        previewText: template.previewText,
        content: template.content,
        html: null,
        sourceTemplateId: template.templateId,
      };
}

export async function sendSnapshotToEmail(
  campaign: Pick<EmailCampaignRow, "templateSnapshot" | "themeSnapshot">,
  email: string,
  mergeData: EmailRecipientMergeData,
): Promise<SendResult> {
  try {
    const rendered = await renderSnapshot(
      campaign.templateSnapshot,
      campaign.themeSnapshot ?? defaultEmailTheme,
      mergeData,
    );
    const messageId = await sendRenderedEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return { email, status: "sent", messageId, error: null };
  } catch (error) {
    return {
      email,
      status: "failed",
      messageId: null,
      error: sanitizeSesError(error),
    };
  }
}

function validateCampaignInput(input: CampaignUpsertInput) {
  const payload = campaignUpsertSchema.parse(input);
  const template = getEmailTemplate(payload.templateId);

  if (!template) {
    throw new EmailCampaignError("Unknown email template", 400);
  }

  return payload;
}

function snapshotFromCampaignPayload(
  payload: ReturnType<typeof campaignUpsertSchema.parse>,
): EmailTemplateSnapshot {
  return {
    name: payload.name,
    type: "structured",
    subject: payload.subject,
    previewText: payload.previewText,
    content: payload.content,
    html: null,
    sourceTemplateId: payload.templateId,
  };
}

async function renderSnapshot(
  snapshot: EmailTemplateSnapshot,
  theme: unknown,
  mergeData: EmailRecipientMergeData,
) {
  if (snapshot.type === "html") {
    return renderHtmlEmail({
      subject: snapshot.subject,
      previewText: snapshot.previewText,
      html: snapshot.html ?? "",
      mergeData,
    });
  }

  return renderCampaignEmail({
    templateId: snapshot.sourceTemplateId,
    subject: snapshot.subject,
    previewText: snapshot.previewText,
    content: snapshot.content,
    theme: theme ?? defaultEmailTheme,
    mergeData,
  });
}

function enforceRecipientLimit(count: number) {
  const { maxRecipients } = getCampaignLimits();

  if (count > maxRecipients) {
    throw new EmailCampaignError(
      `Recipient list exceeds ${maxRecipients} addresses`,
      400,
    );
  }
}

function buildMergeData(
  email: string,
  mergeData?: Record<string, string>,
): EmailRecipientMergeData {
  return {
    ...mergeDataForEmail(email),
    ...mergeData,
    email,
  };
}

export async function upsertRecipientResult(
  campaignId: string,
  email: string,
  mergeData: EmailRecipientMergeData,
  result: SendResult,
) {
  const now = new Date().toISOString();

  await db
    .insert(emailCampaignRecipients)
    .values({
      campaignId,
      email,
      mergeData,
      status: result.status,
      messageId: result.messageId,
      error: result.error,
      sentAt: result.status === "sent" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        emailCampaignRecipients.campaignId,
        emailCampaignRecipients.email,
      ],
      set: {
        mergeData,
        status: result.status,
        messageId: result.messageId,
        error: result.error,
        sentAt: result.status === "sent" ? now : null,
        updatedAt: now,
      },
    });
}

async function updateRecipientResult(recipientId: string, result: SendResult) {
  const now = new Date().toISOString();

  await db
    .update(emailCampaignRecipients)
    .set({
      status: result.status,
      messageId: result.messageId,
      error: result.error,
      sentAt: result.status === "sent" ? now : null,
      updatedAt: now,
    })
    .where(eq(emailCampaignRecipients.id, recipientId));
}

export async function refreshCampaignCounts(
  campaignId: string,
  organizer: Pick<UserEntry, "id">,
) {
  const status = await campaignStatus(campaignId);
  const now = new Date().toISOString();
  const complete = status.pendingCount === 0 && status.totalRecipients > 0;
  const campaignStatusValue = complete
    ? status.failedCount > 0
      ? "failed"
      : "sent"
    : status.totalRecipients > 0
      ? "sending"
      : "draft";

  await db
    .update(emailCampaigns)
    .set({
      totalRecipients: status.totalRecipients,
      sentCount: status.sentCount,
      failedCount: status.failedCount,
      status: campaignStatusValue,
      completedAt: complete ? now : null,
      updatedByUserId: organizer.id,
      updatedAt: now,
    })
    .where(eq(emailCampaigns.id, campaignId));

  return {
    campaignId,
    ...status,
    complete,
  };
}

async function campaignStatus(campaignId: string) {
  const recipients = await db
    .select({
      email: emailCampaignRecipients.email,
      status: emailCampaignRecipients.status,
      error: emailCampaignRecipients.error,
    })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, campaignId));

  const sentCount = recipients.filter(
    (recipient) => recipient.status === "sent",
  ).length;
  const failedCount = recipients.filter(
    (recipient) => recipient.status === "failed",
  ).length;
  const pendingCount = recipients.filter(
    (recipient) => recipient.status === "pending",
  ).length;
  const recentFailures = recipients
    .filter((recipient) => recipient.status === "failed")
    .slice(-10)
    .map((recipient) => ({
      email: recipient.email,
      error: recipient.error,
    }));

  return {
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
    pendingCount,
    nextCursor: sentCount + failedCount,
    invalid: [],
    duplicateCount: 0,
    recentFailures,
  };
}

function campaignFromRow(row: EmailCampaignRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    subject: row.subject,
    previewText: row.previewText,
    totalRecipients: row.totalRecipients,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    isDirectSend: row.isDirectSend,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
