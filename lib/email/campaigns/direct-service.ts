import { requireOrganizer } from "@/lib/auth/guards";
import {
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import {
  mergeDataForEmail,
  parseRecipientText,
} from "@/lib/email/campaigns/recipients";
import {
  createDirectCampaign,
  getCampaign,
  processCampaignBatch,
  recordCampaignEvent,
  refreshCampaignCounts,
  sendSnapshotToEmail,
  snapshotFromDirectTemplate,
  upsertRecipientResult,
  type SendResult,
} from "@/lib/email/campaigns/service";
import {
  directBatchSendSchema,
  directEmailTemplateSchema,
  directRecipientParseSchema,
  directSendOneSchema,
  directTestSendSchema,
} from "@/lib/email/types";

export function parseDirectRecipients(input: unknown) {
  const body = directRecipientParseSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  enforceRecipientLimit(parsed.emails.length);

  return parsed;
}

export async function sendOneDirectEmail(input: unknown) {
  const organizer = await requireOrganizer();
  const body = directSendOneSchema.parse(input);
  const email = body.email.trim().toLowerCase();
  const mergeData = buildMergeData(email, body.mergeData);
  const campaign = await createDirectCampaign({
    template: body.template,
    organizer,
    recipients: [{ email, mergeData }],
  });
  const result = await sendSnapshotToEmail(campaign, email, mergeData);

  await upsertRecipientResult(campaign.id, email, mergeData, result);
  await refreshCampaignCounts(campaign.id, organizer);
  await recordCampaignEvent({
    campaignId: campaign.id,
    organizer,
    eventType: "direct_single_send",
    details: {
      email,
      status: result.status,
      messageId: result.messageId,
      error: result.error,
    },
  });

  return result;
}

export async function sendDirectTestEmails(input: unknown) {
  const organizer = await requireOrganizer();
  const body = directTestSendSchema.parse(input);
  const emails = Array.from(
    new Set(body.emails.map((email) => email.trim().toLowerCase())),
  );
  const campaignLike = {
    templateSnapshot: snapshotFromDirectTemplate(body.template),
    themeSnapshot:
      body.template.type === "structured"
        ? (body.template.theme ?? null)
        : null,
  };
  const results: SendResult[] = [];

  for (const email of emails) {
    results.push(
      await sendSnapshotToEmail(
        campaignLike,
        email,
        buildMergeData(email, body.mergeData),
      ),
    );
  }

  await recordCampaignEvent({
    campaignId: null,
    organizer,
    eventType: "direct_test_send",
    details: {
      total: results.length,
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
    },
  });

  return results;
}

export async function sendDirectBatch(input: unknown) {
  const organizer = await requireOrganizer();
  const body = directBatchSendSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  enforceRecipientLimit(parsed.emails.length);

  if (parsed.emails.length === 0) {
    throw new EmailCampaignError("Add at least one valid recipient", 400);
  }

  const campaign = body.campaignId
    ? await getCampaign(body.campaignId)
    : await createDirectCampaign({
        template: body.template,
        organizer,
        recipients: parsed.recipients.map((recipient) => ({
          email: recipient.email,
          mergeData: buildMergeData(recipient.email, recipient.mergeData),
        })),
      });

  const status = await processCampaignBatch(campaign.id);
  const pendingCount = status.pendingCount;

  return {
    campaignId: campaign.id,
    totalRecipients: status.totalRecipients,
    sentCount: status.sentCount,
    failedCount: status.failedCount,
    pendingCount,
    nextCursor: status.nextCursor,
    complete: pendingCount === 0,
    invalid: parsed.invalid,
    duplicateCount: parsed.duplicateCount,
    columns: parsed.columns,
    recentFailures: status.recentFailures,
  };
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

function buildMergeData(email: string, mergeData?: Record<string, string>) {
  return {
    ...mergeDataForEmail(email),
    ...mergeData,
    email,
  };
}

export function validateDirectEmailTemplate(input: unknown) {
  return directEmailTemplateSchema.parse(input);
}
