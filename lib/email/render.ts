import { render, toPlainText } from "@react-email/render";
import { getEmailTemplate } from "@/lib/email/templates/registry";
import { defaultEmailTheme } from "@/lib/email/theme";
import {
  emailCampaignContentSchema,
  emailRenderPreviewSchema,
  emailThemeTokensSchema,
  type EmailCampaignContent,
} from "@/lib/email/types";

export interface RenderCampaignEmailInput {
  templateId: string;
  subject: string;
  previewText: string;
  content: unknown;
  theme?: unknown;
  mergeData?: Record<string, string>;
}

export interface RenderedCampaignEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderCampaignEmail({
  templateId,
  subject,
  previewText,
  content,
  theme,
  mergeData = {},
}: RenderCampaignEmailInput): Promise<RenderedCampaignEmail> {
  const template = getEmailTemplate(templateId);

  if (!template) {
    throw new Error("Unknown email template");
  }

  const parsedContent = emailCampaignContentSchema.parse(content);
  const parsedTheme = theme
    ? emailThemeTokensSchema.parse(theme)
    : defaultEmailTheme;
  const mergedContent = mergeContent(parsedContent, mergeData);
  const mergedPreviewText = mergeText(previewText, mergeData);
  const mergedSubject = mergeText(subject, mergeData);
  const element = template.render({
    content: mergedContent,
    previewText: mergedPreviewText,
    theme: parsedTheme,
  });

  const html = await render(element, { pretty: true });
  const text = await render(element, { plainText: true });

  return {
    subject: mergedSubject,
    html,
    text,
  };
}

export async function renderEmailPreview(input: unknown) {
  const parsed = emailRenderPreviewSchema.parse(input);
  const mergeData = {
    email: "hacker@mhacks.org",
    expires_in: "10 minutes",
    name: "Hacker",
    otp_code: "123456",
    travel_reimbursement: "150.00",
    ...parsed.mergeData,
  };

  if (parsed.type === "html") {
    return renderHtmlEmail({
      subject: parsed.subject,
      previewText: parsed.previewText,
      html: parsed.html,
      mergeData,
    });
  }

  return renderCampaignEmail({
    templateId: parsed.templateId,
    subject: parsed.subject,
    previewText: parsed.previewText,
    content: parsed.content,
    theme: parsed.theme,
    mergeData,
  });
}

export function renderHtmlEmail({
  subject,
  previewText,
  html,
  mergeData = {},
}: {
  subject: string;
  previewText: string;
  html: string;
  mergeData?: Record<string, string>;
}): RenderedCampaignEmail {
  const mergedSubject = mergeText(subject, mergeData);
  const mergedPreviewText = mergeText(previewText, mergeData);
  const safeHtml = sanitizeHtmlTemplate(mergeText(html, mergeData));
  const document = safeHtml.includes("<html")
    ? safeHtml
    : `<!DOCTYPE html><html><head><meta charSet="utf-8" /><title>${escapeHtml(
        mergedSubject,
      )}</title></head><body>${safeHtml}</body></html>`;
  const withPreview = document.replace(
    /<body([^>]*)>/i,
    `<body$1><div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${escapeHtml(
      mergedPreviewText,
    )}</div>`,
  );

  return {
    subject: mergedSubject,
    html: withPreview,
    text: toPlainText(withPreview),
  };
}

function mergeContent(
  content: EmailCampaignContent,
  mergeData: Record<string, string>,
): EmailCampaignContent {
  return {
    ...content,
    eyebrow: content.eyebrow
      ? mergeText(content.eyebrow, mergeData)
      : undefined,
    heading: mergeText(content.heading, mergeData),
    intro: content.intro ? mergeText(content.intro, mergeData) : undefined,
    sections: content.sections.map((section) => ({
      ...section,
      title: section.title ? mergeText(section.title, mergeData) : undefined,
      body: mergeText(section.body, mergeData),
    })),
    cta: content.cta
      ? {
          label: mergeText(content.cta.label, mergeData),
          url: mergeText(content.cta.url, mergeData),
        }
      : undefined,
    footerNote: content.footerNote
      ? mergeText(content.footerNote, mergeData)
      : undefined,
  };
}

function mergeText(value: string, mergeData: Record<string, string>) {
  return value.replace(/{{\s*([\w.-]+)\s*}}/g, (_match, key: string) => {
    return mergeData[key] ?? "";
  });
}

function sanitizeHtmlTemplate(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
