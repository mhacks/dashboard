import { defaultEmailMergeSamples } from "@/lib/email/merge-fields";
import type {
  EmailCampaignContent,
  EmailTemplateType,
} from "@/lib/email/types";

export type AiDraftTemplateContext = {
  name: string;
  type: EmailTemplateType;
  description: string;
  subject: string;
  previewText: string;
  content: EmailCampaignContent | null;
  html: string | null;
};

export function toAiDraftTemplateContext(
  input: AiDraftTemplateContext,
): AiDraftTemplateContext {
  return {
    name: input.name,
    type: input.type,
    description: input.description,
    subject: input.subject,
    previewText: input.previewText,
    content: input.content,
    html: input.html,
  };
}

export function buildAiTemplateContext(
  template: AiDraftTemplateContext,
  mergeFields: string[],
) {
  const allowedMergeFields = Array.from(
    new Set([...Object.keys(defaultEmailMergeSamples), ...mergeFields]),
  ).sort((a, b) => a.localeCompare(b));
  const draftSchema =
    template.type === "html"
      ? {
          name: "optional short template name",
          description: "optional admin-only description",
          subject: "required subject, max 180 chars",
          previewText: "optional inbox preview, max 220 chars",
          html: "required HTML fragment or document; no scripts, event handlers, or javascript URLs",
        }
      : {
          name: "optional short template name",
          description: "optional admin-only description",
          subject: "required subject, max 180 chars",
          previewText: "optional inbox preview, max 220 chars",
          content: {
            eyebrow: "optional short eyebrow",
            heading: "required heading",
            intro: "optional intro line",
            sections: [
              {
                kind: "text or code",
                title: "optional section title",
                body: "required section copy",
              },
            ],
            cta: {
              label:
                "the button text — required together with url, see rules below",
              url: "plain http(s) or mailto URL; Markdown link syntax is accepted and normalized — required together with label",
            },
            footerNote: "optional footer note",
          },
        };

  return [
    "# MHacks Email Template Drafting Context (Beta)",
    "",
    "You are generating an MHacks email template for organizers from their description. Return ONLY valid JSON. Do not include Markdown fences or commentary.",
    "",
    "Rules:",
    "- Keep the message concise and operational.",
    "- Use only the allowed merge fields listed below.",
    "- Merge fields must be written as {{field_name}}.",
    "- Do not invent applicant segments, audience sources, backend behavior, or sending rules.",
    "- Do not include scripts, event handlers, tracking pixels, external forms, or javascript URLs.",
    "- The cta field is entirely optional, but if you include it, both label and url are required together — never send one without the other. If you don't know the real destination URL, omit the cta field entirely rather than guessing or leaving url blank.",
    "- Write the full email to match the organizer's description.",
    "- If you include content (or html), return the COMPLETE block — it replaces the existing one wholesale, it is not merged field by field.",
    "- The imported draft is applied to the current template in place; it will not create a separate template.",
    "- The organizer will review before saving or sending.",
    "",
    `Template type: ${template.type}`,
    `Allowed merge fields: ${allowedMergeFields.join(", ") || "none"}`,
    "",
    "Expected JSON shape:",
    JSON.stringify(draftSchema, null, 2),
    "",
    "Starting template:",
    JSON.stringify(template, null, 2),
  ].join("\n");
}
