"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  parseDirectRecipients,
  sendDirectBatch,
  sendDirectTestEmails,
  sendOneDirectEmail,
} from "@/lib/email/campaigns/direct-service";
import { renderEmailPreview } from "@/lib/email/render";
import {
  createMasterTemplate,
  deleteMasterTemplate,
  saveActiveTheme,
  updateMasterTemplate,
} from "@/lib/email/templates/master-service";
import {
  emailTemplateUpsertSchema,
  emailThemeTokensSchema,
  type EmailTemplateUpsertInput,
  type EmailThemeTokens,
} from "@/lib/email/types";

const emailCampaignsPath = "/admin/email-campaigns";

export async function saveEmailTemplateAction(input: {
  templateId?: string;
  template: EmailTemplateUpsertInput;
}) {
  const payload = emailTemplateUpsertSchema.parse(input.template);
  const template = input.templateId
    ? await updateMasterTemplate(input.templateId, payload)
    : await createMasterTemplate(payload);

  revalidatePath(emailCampaignsPath);
  return template;
}

export async function deleteEmailTemplateAction(templateId: string) {
  await deleteMasterTemplate(templateId);
  revalidatePath(emailCampaignsPath);
  return { success: true };
}

export async function saveEmailThemeAction(input: EmailThemeTokens) {
  const theme = await saveActiveTheme(emailThemeTokensSchema.parse(input));
  revalidatePath(emailCampaignsPath);
  return theme;
}

export async function renderEmailPreviewAction(input: unknown) {
  await requireOrganizer();
  return renderEmailPreview(input);
}

export async function parseDirectRecipientsAction(input: unknown) {
  return parseDirectRecipients(input);
}

export async function sendOneDirectEmailAction(input: unknown) {
  const result = await sendOneDirectEmail(input);

  return { result };
}

export async function sendDirectTestEmailsAction(input: unknown) {
  const { results, testSendToken, testSendExpiresAt } =
    await sendDirectTestEmails(input);
  const redactedResults = results.map((result) => ({
    status: result.status,
    messageId: result.messageId,
    error: redactEmailAddresses(result.error),
  }));
  const firstFailure = redactedResults.find(
    (result) => result.status === "failed",
  );

  return {
    results: redactedResults,
    testSendToken,
    testSendExpiresAt,
    error: firstFailure?.error,
  };
}

export async function sendDirectBatchAction(input: unknown) {
  return sendDirectBatch(input);
}

function redactEmailAddresses(value: string | null) {
  return (
    value?.replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[test recipient]",
    ) ?? null
  );
}
