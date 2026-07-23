"use server";

import { revalidatePath } from "next/cache";
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
