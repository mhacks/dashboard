import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { emailCampaignEvents } from "@/lib/db/schema/email";
import {
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import { requiredEmailCampaignTestRecipients } from "@/lib/email/campaigns/constants";
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
import { defaultEmailTheme } from "@/lib/email/theme";
import {
  directBatchSendSchema,
  directEmailTemplateSchema,
  directRecipientParseSchema,
  directSendOneSchema,
  directTestSendSchema,
  type DirectEmailTemplateInput,
} from "@/lib/email/types";

const successfulTestProofWindowMs = 30 * 60 * 1000;
const maxRecentTestProofEvents = 25;

interface ApprovedTestSend {
  templateFingerprint: string;
  testSendToken: string;
  testSendExpiresAt: string;
}

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
  const templateFingerprint = fingerprintDirectTemplate(body.template);
  const recipients = requiredEmailCampaignTestRecipients;
  const campaignLike = {
    templateSnapshot: snapshotFromDirectTemplate(body.template),
    themeSnapshot:
      body.template.type === "structured"
        ? (body.template.theme ?? defaultEmailTheme)
        : null,
  };
  const results: SendResult[] = [];

  for (const recipient of recipients) {
    results.push(
      await sendSnapshotToEmail(
        campaignLike,
        recipient.email,
        buildMergeData(recipient.email, {
          ...body.mergeData,
          ...recipient.mergeData,
        }),
      ),
    );
  }

  const sentCount = results.filter((result) => result.status === "sent").length;
  const failedCount = results.filter(
    (result) => result.status === "failed",
  ).length;
  const testSendToken =
    results.length > 0 && failedCount === 0 ? randomUUID() : null;
  const testSendExpiresAt = testSendToken
    ? new Date(Date.now() + successfulTestProofWindowMs).toISOString()
    : null;

  await recordCampaignEvent({
    campaignId: null,
    organizer,
    eventType: "direct_test_send",
    details: {
      total: results.length,
      sent: sentCount,
      failed: failedCount,
      templateFingerprint,
      testSendToken,
      testSendExpiresAt,
      requiredTestRecipientCount: recipients.length,
    },
  });

  return {
    results,
    testSendToken,
    testSendExpiresAt,
  };
}

export async function sendDirectBatch(input: unknown) {
  const organizer = await requireOrganizer();
  const body = directBatchSendSchema.parse(input);
  const parsed = body.campaignId
    ? {
        recipients: [],
        emails: [],
        invalid: [],
        duplicateCount: 0,
        columns: [],
      }
    : parseRecipientText(body.recipients);

  const campaign = body.campaignId
    ? await getValidatedDirectCampaignContinuation({
        campaignId: body.campaignId,
        organizer,
        template: body.template,
        testSendToken: body.testSendToken,
      })
    : null;
  let approvedTestSend: ApprovedTestSend | undefined;

  if (!campaign) {
    enforceRecipientLimit(parsed.emails.length);

    if (parsed.emails.length === 0) {
      throw new EmailCampaignError("Add at least one valid recipient", 400);
    }

    approvedTestSend = await assertSuccessfulTestSend({
      organizer,
      template: body.template,
      testSendToken: body.testSendToken,
    });
  }

  const campaignToSend =
    campaign ??
    (await createDirectCampaign({
      template: body.template,
      organizer,
      recipients: parsed.recipients.map((recipient) => ({
        email: recipient.email,
        mergeData: buildMergeData(recipient.email, recipient.mergeData),
      })),
      approvedTestSend,
    }));

  const status = await processCampaignBatch(campaignToSend.id);
  const pendingCount = status.pendingCount;
  const sendingCount = status.sendingCount;

  return {
    campaignId: campaignToSend.id,
    totalRecipients: status.totalRecipients,
    sentCount: status.sentCount,
    failedCount: status.failedCount,
    pendingCount,
    sendingCount,
    nextCursor: status.nextCursor,
    complete: pendingCount === 0 && sendingCount === 0,
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

async function getValidatedDirectCampaignContinuation({
  campaignId,
  organizer,
  template,
  testSendToken,
}: {
  campaignId: string;
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
}) {
  const campaign = await getCampaign(campaignId);

  if (
    !campaign.isDirectSend ||
    !campaign.startedAt ||
    campaign.createdByUserId !== organizer.id
  ) {
    throw new EmailCampaignError(
      "Run a successful test send before starting a full list send",
      428,
    );
  }

  const [createdEvent] = await db
    .select({
      details: emailCampaignEvents.details,
    })
    .from(emailCampaignEvents)
    .where(
      and(
        eq(emailCampaignEvents.campaignId, campaign.id),
        eq(emailCampaignEvents.eventType, "direct_campaign_created"),
      ),
    )
    .orderBy(desc(emailCampaignEvents.createdAt))
    .limit(1);
  const approvedTestSend = parseApprovedTestSend(
    createdEvent?.details.approvedTestSend,
  );
  const expectedFingerprint = fingerprintDirectTemplate(template);
  const campaignFingerprint = fingerprintCampaignSnapshot(campaign);
  const freshApproval = await findSuccessfulTestSend({
    organizer,
    template,
    testSendToken,
  });

  if (
    !approvedTestSend ||
    !freshApproval ||
    approvedTestSend.templateFingerprint !== expectedFingerprint ||
    approvedTestSend.templateFingerprint !== campaignFingerprint ||
    freshApproval.templateFingerprint !== campaignFingerprint
  ) {
    throw new EmailCampaignError(
      "Run a fresh successful test send before continuing a full list send",
      428,
    );
  }

  return campaign;
}

async function findSuccessfulTestSend({
  organizer,
  template,
  testSendToken,
}: {
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
}): Promise<ApprovedTestSend | null> {
  if (!testSendToken) {
    return null;
  }

  const expectedFingerprint = fingerprintDirectTemplate(template);
  const now = Date.now();
  const events = await db
    .select({
      details: emailCampaignEvents.details,
    })
    .from(emailCampaignEvents)
    .where(
      and(
        eq(emailCampaignEvents.actorUserId, organizer.id),
        eq(emailCampaignEvents.eventType, "direct_test_send"),
      ),
    )
    .orderBy(desc(emailCampaignEvents.createdAt))
    .limit(maxRecentTestProofEvents);

  const matchingProof = events.find(({ details }) => {
    if (
      details.testSendToken !== testSendToken ||
      details.templateFingerprint !== expectedFingerprint ||
      typeof details.testSendExpiresAt !== "string" ||
      typeof details.sent !== "number" ||
      typeof details.failed !== "number" ||
      details.sent < 1 ||
      details.failed !== 0
    ) {
      return false;
    }

    return Date.parse(details.testSendExpiresAt) > now;
  });

  if (
    !matchingProof ||
    typeof matchingProof.details.testSendExpiresAt !== "string"
  ) {
    return null;
  }

  return {
    templateFingerprint: expectedFingerprint,
    testSendToken,
    testSendExpiresAt: matchingProof.details.testSendExpiresAt,
  };
}

async function assertSuccessfulTestSend({
  organizer,
  template,
  testSendToken,
}: {
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
}): Promise<ApprovedTestSend> {
  const matchingProof = await findSuccessfulTestSend({
    organizer,
    template,
    testSendToken,
  });

  if (!matchingProof) {
    throw new EmailCampaignError(
      "Run a fresh successful test send before starting a full list send",
      428,
    );
  }

  return matchingProof;
}

function parseApprovedTestSend(value: unknown): ApprovedTestSend | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.templateFingerprint !== "string" ||
    typeof candidate.testSendToken !== "string" ||
    typeof candidate.testSendExpiresAt !== "string"
  ) {
    return null;
  }

  return {
    templateFingerprint: candidate.templateFingerprint,
    testSendToken: candidate.testSendToken,
    testSendExpiresAt: candidate.testSendExpiresAt,
  };
}

function fingerprintDirectTemplate(template: DirectEmailTemplateInput) {
  const payload =
    template.type === "structured"
      ? {
          snapshot: snapshotFromDirectTemplate(template),
          theme: template.theme ?? defaultEmailTheme,
        }
      : {
          snapshot: snapshotFromDirectTemplate(template),
          theme: null,
        };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function fingerprintCampaignSnapshot(campaign: {
  templateSnapshot: unknown;
  themeSnapshot: unknown;
}) {
  return createHash("sha256")
    .update(
      stableStringify({
        snapshot: campaign.templateSnapshot,
        theme: campaign.themeSnapshot,
      }),
    )
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
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
