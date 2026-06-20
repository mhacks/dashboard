import { EmailCampaignError } from "@/lib/email/campaigns/config";
import { renderCampaignEmail, renderHtmlEmail } from "@/lib/email/render";
import { defaultEmailTheme } from "@/lib/email/theme";
import { getTemplateCatalog } from "@/lib/email/templates/registry";
import {
  emailTemplateUpsertSchema,
  emailThemeTokensSchema,
  htmlTemplateUploadSchema,
  type EmailCampaignContent,
  type EmailTemplateType,
  type EmailThemeTokens,
} from "@/lib/email/types";

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
  return {
    templates: getSeedMasterTemplates(),
    databaseReady: false,
  };
}

export async function createMasterTemplate(input: unknown) {
  const payload = emailTemplateUpsertSchema.parse(input);

  return templateFromPayload(`local-${crypto.randomUUID()}`, payload);
}

export async function uploadHtmlTemplate(input: unknown) {
  const payload = htmlTemplateUploadSchema.parse(input);

  return templateFromPayload(`local-${crypto.randomUUID()}`, {
    ...payload,
    type: "html",
    content: undefined,
    status: "active",
  });
}

export async function updateMasterTemplate(templateId: string, input: unknown) {
  const payload = emailTemplateUpsertSchema.parse(input);

  return templateFromPayload(templateId, payload);
}

export async function deleteMasterTemplate(_templateId: string) {
  void _templateId;
  return;
}

export async function getActiveTheme() {
  return {
    theme: defaultEmailTheme,
    databaseReady: false,
  };
}

export async function saveActiveTheme(input: unknown) {
  return emailThemeTokensSchema.parse(input);
}

export async function createCampaignFromMaster(_template: MasterTemplate) {
  void _template;
  throw new EmailCampaignError("Campaign persistence is unavailable", 409);
}

export async function renderMasterTemplatePreview(input: {
  template: MasterTemplate;
  theme?: EmailThemeTokens;
}) {
  if (input.template.type === "html") {
    return renderHtmlEmail({
      subject: input.template.subject,
      previewText: input.template.previewText,
      html: input.template.html ?? "",
    });
  }

  return renderCampaignEmail({
    templateId: input.template.sourceTemplateId,
    subject: input.template.subject,
    previewText: input.template.previewText,
    content: input.template.content,
    theme: input.theme ?? defaultEmailTheme,
    mergeData: {
      name: "Hacker",
      email: "hacker@mhacks.org",
      travel_reimbursement: "150.00",
    },
  });
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

function templateFromPayload(
  id: string,
  payload: ReturnType<typeof emailTemplateUpsertSchema.parse>,
): MasterTemplate {
  return {
    id,
    name: payload.name,
    type: payload.type,
    description: payload.description,
    subject: payload.subject,
    previewText: payload.previewText,
    content: payload.content ?? null,
    html: payload.html ?? null,
    status: payload.status,
    updatedAt: new Date().toISOString(),
    sourceTemplateId: "mhacks-announcement",
  };
}
