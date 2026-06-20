import {
  assertCampaignsEnabled,
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
import {
  directBatchSendSchema,
  directEmailTemplateSchema,
  directRecipientParseSchema,
  directSendOneSchema,
  directTestSendSchema,
  type DirectEmailTemplateInput,
} from "@/lib/email/types";

interface DirectSendResult {
  email: string;
  status: "sent" | "failed";
  messageId: string | null;
  error: string | null;
}

export function parseDirectRecipients(input: unknown) {
  assertCampaignsEnabled();
  const body = directRecipientParseSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  enforceRecipientLimit(parsed.emails.length);

  return parsed;
}

export async function sendOneDirectEmail(input: unknown) {
  assertCampaignsEnabled();
  const body = directSendOneSchema.parse(input);
  const email = body.email.trim().toLowerCase();

  return sendDirectTemplateEmail({
    template: body.template,
    email,
    mergeData: buildMergeData(email, body.mergeData),
  });
}

export async function sendDirectTestEmails(input: unknown) {
  assertCampaignsEnabled();
  const body = directTestSendSchema.parse(input);
  const emails = Array.from(
    new Set(body.emails.map((email) => email.trim().toLowerCase())),
  );
  const results: DirectSendResult[] = [];

  for (const email of emails) {
    results.push(
      await sendDirectTemplateEmail({
        template: body.template,
        email,
        mergeData: buildMergeData(email, body.mergeData),
      }),
    );
  }

  return results;
}

export async function sendDirectBatch(input: unknown) {
  assertFullCampaignSendingAllowed();
  const body = directBatchSendSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  const limits = getCampaignLimits();
  enforceRecipientLimit(parsed.emails.length);

  if (parsed.emails.length === 0) {
    throw new EmailCampaignError("Add at least one valid recipient", 400);
  }

  const batchRecipients = parsed.recipients.slice(
    body.cursor,
    body.cursor + limits.batchSize,
  );
  let sentCount = body.sentCount;
  let failedCount = body.failedCount;
  const recentFailures = [...body.recentFailures].slice(-10);

  for (const recipient of batchRecipients) {
    const result = await sendDirectTemplateEmail({
      template: body.template,
      email: recipient.email,
      mergeData: buildMergeData(recipient.email, recipient.mergeData),
    });

    if (result.status === "sent") {
      sentCount += 1;
    } else {
      failedCount += 1;
      recentFailures.push({
        email: result.email,
        error: result.error,
      });
    }

    await sleep(limits.sendDelayMs);
  }

  const nextCursor = body.cursor + batchRecipients.length;
  const pendingCount = Math.max(0, parsed.emails.length - nextCursor);

  return {
    totalRecipients: parsed.emails.length,
    sentCount,
    failedCount,
    pendingCount,
    nextCursor,
    complete: pendingCount === 0,
    invalid: parsed.invalid,
    duplicateCount: parsed.duplicateCount,
    columns: parsed.columns,
    recentFailures: recentFailures.slice(-10),
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

async function sendDirectTemplateEmail({
  template,
  email,
  mergeData,
}: {
  template: DirectEmailTemplateInput;
  email: string;
  mergeData: Record<string, string>;
}): Promise<DirectSendResult> {
  try {
    const rendered =
      template.type === "html"
        ? renderHtmlEmail({
            subject: template.subject,
            previewText: template.previewText,
            html: template.html,
            mergeData,
          })
        : await renderCampaignEmail({
            templateId: template.templateId,
            subject: template.subject,
            previewText: template.previewText,
            content: template.content,
            theme: template.theme,
            mergeData,
          });
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

function buildMergeData(email: string, mergeData?: Record<string, string>) {
  return {
    ...mergeDataForEmail(email),
    ...mergeData,
    email,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateDirectEmailTemplate(input: unknown) {
  return directEmailTemplateSchema.parse(input);
}
